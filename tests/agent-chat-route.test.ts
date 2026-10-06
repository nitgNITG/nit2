import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

type Script = (req: { messages: unknown[]; signal?: AbortSignal }, onText: (d: string) => void) => Promise<unknown>;
const { mongo, mysql, alertAdmins, notifyTelegram, getCurrentUser, llm, script } = vi.hoisted(() => {
    const script: { steps: Script[] } = { steps: [] };
    return {
        mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
        mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
        alertAdmins: vi.fn(),
        notifyTelegram: vi.fn(),
        getCurrentUser: vi.fn(),
        script,
        llm: {
            stream: vi.fn((req: never, onText: (d: string) => void) => {
                const step = script.steps.shift();
                if (!step) throw new Error("no scripted model reply left");
                return step(req, onText);
            }),
            complete: vi.fn(async () => ({ text: "{}", toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [] })),
            estimateInputTokens: vi.fn(() => 1000),
        },
    };
});
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "+20 100 000 0000" }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { POST as chat } from "@/app/api/agent/chat/route";
import { GET as config } from "@/app/api/agent/config/route";
import { GET as history } from "@/app/api/agent/conversations/[id]/route";
import { POST as handoff } from "@/app/api/agent/conversations/[id]/handoff/route";
import { POST as rating } from "@/app/api/agent/conversations/[id]/rating/route";
import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { takeOver } from "@/lib/agent/runtime/state";

const USAGE = { inputTokens: 1000, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 };
const reply = (text: string, toolCalls: { id: string; name: string; input: unknown }[] = []): Script => async (_req, onText) => {
    for (const w of text.split(/(?<= )/)) onText(w);
    return { text, toolCalls, stopReason: toolCalls.length ? "tool_use" : "end", usage: USAGE, model: "claude-sonnet-5-5", raw: [{ type: "text", text }] };
};

async function setConfig(over: Record<string, unknown> = {}) {
    await mysql.platformSetting.deleteMany({ where: { key: "ai_agent_config" } });
    await mysql.platformSetting.create({
        data: { key: "ai_agent_config", value: JSON.stringify({ ...DEFAULT_CONFIG, enabled: { web: true, whatsapp: false }, dailyBudgetUsd: 5, version: 1, ...over }) },
    });
}

let ip = 0;
function post(body: unknown, cookie?: string, xff = `10.0.0.${++ip}`) {
    return chat(new Request("http://localhost/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": xff, ...(cookie ? { cookie } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body),
    }));
}
const get = (path: string, cookie?: string) => new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} });

type Ev = { event: string; data: Record<string, unknown> };
async function events(res: Response): Promise<Ev[]> {
    const text = await res.text();
    return text.split("\n\n").filter(Boolean).map((block) => {
        const [e, d] = block.split("\n");
        return { event: e.replace("event: ", ""), data: JSON.parse(d.replace("data: ", "")) };
    });
}
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

/** Starts a conversation; returns its id and the visitor's cookie. */
async function start(text = "Hello", steps: Script[] = [reply("Hi! How can I help?")]) {
    script.steps.push(...steps);
    const res = await post({ message: text, locale: "en", page: "/en/pricing", utm: { source: "google", medium: "cpc", campaign: "moodle-eg" } });
    const evs = await events(res);
    return { res, evs, id: evs[0].data.conversationId as string, cookie: cookieOf(res) };
}

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    script.steps.length = 0;
    getCurrentUser.mockResolvedValue(null);
    process.env.SECRET_JWT = "test-secret-at-least-32-characters-long";
    await setConfig();
});
afterEach(() => vi.useRealTimers());

describe("POST /api/agent/chat — validation and gates", () => {
    it("TS-01: empty → 400, 2,001 chars → 413, wrong locale → 400, bad JSON → 400", async () => {
        expect((await post({ message: "   ", locale: "en" })).status).toBe(400);
        const long = await post({ message: "x".repeat(2001), locale: "en" });
        expect(long.status).toBe(413);
        expect(await long.json()).toMatchObject({ error: "message_too_long" });
        expect((await post({ message: "hi", locale: "fr" })).status).toBe(400);
        expect((await post("{nope")).status).toBe(400);
        expect(llm.stream).not.toHaveBeenCalled();
    });

    it("TS-04 / AC-09.2: agent off → 503 agent_disabled with fallback links", async () => {
        await setConfig({ enabled: { web: false, whatsapp: false } });
        const res = await post({ message: "hi", locale: "ar" });
        expect(res.status).toBe(503);
        expect(await res.json()).toMatchObject({ error: "agent_disabled", fallback: { whatsapp: "https://wa.me/201000000000", contactUrl: "/ar/contact" } });
        const cfg = await (await config(get("/api/agent/config?locale=ar&page=/ar") as never)).json();
        expect(cfg.enabled).toBe(false);
    });

    it("TS-04 / AC-09.3: budget used up → 503 budget_exhausted and exactly one admin alert that day", async () => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
        await mongo.usageDaily.create({ data: { date: today, spentUsd: 5, committedUsd: 5 } });
        const a = await post({ message: "hi", locale: "en" });
        const b = await post({ message: "hi again", locale: "en" });
        expect(a.status).toBe(503);
        expect(await b.json()).toMatchObject({ error: "budget_exhausted" });
        expect(alertAdmins).toHaveBeenCalledTimes(1);
        expect(llm.stream).not.toHaveBeenCalled();
    });

    it("TS-06: the 21st message from one IP within 10 minutes → 429", async () => {
        const { id, cookie } = await start();
        await mongo.conversation.update({ where: { id }, data: { status: "human" } }); // no model calls needed
        // start() used a fresh IP; reuse one fixed IP for the 21 messages
        for (let i = 0; i < 20; i++) expect((await post({ conversationId: id, message: `m${i}`, locale: "en" }, cookie, "9.9.9.9")).status).toBe(200);
        const res = await post({ conversationId: id, message: "m21", locale: "en" }, cookie, "9.9.9.9");
        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ error: "rate_limited" });
    });

    it("NFR-6: a 6th new conversation from one IP within the hour → 429", async () => {
        for (let i = 0; i < 5; i++) {
            script.steps.push(reply("ok"));
            expect((await post({ message: "hi", locale: "en" }, undefined, "7.7.7.7")).status).toBe(200);
        }
        expect((await post({ message: "hi", locale: "en" }, undefined, "7.7.7.7")).status).toBe(429);
    });
});

describe("POST /api/agent/chat — a turn", () => {
    it("TS-02 / AC-01.2: a new conversation stores page + UTM, sets the session cookie, and streams meta → deltas → done", async () => {
        const { res, evs, id, cookie } = await start("What is NITG?");
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        expect(cookie).toMatch(/^agent_session=[a-f0-9]{24}\./);
        expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
        expect(evs[0]).toEqual({ event: "meta", data: { conversationId: id, mode: "sales", status: "open" } });
        expect(evs.filter((e) => e.event === "delta").map((e) => e.data.text).join("")).toBe("Hi! How can I help?");
        expect(evs.at(-1)!.event).toBe("done");

        const conv = await mongo.conversation.findUnique({ where: { id } });
        expect(conv).toMatchObject({ sourcePage: "/en/pricing", utmSource: "google", utmMedium: "cpc", utmCampaign: "moodle-eg", status: "open", messageCount: 2 });
        const msgs = await mongo.chatMessage.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
        expect(msgs.map((m) => [m.role, m.content])).toEqual([["visitor", "What is NITG?"], ["assistant", "Hi! How can I help?"]]);
        expect(msgs[1]).toMatchObject({ model: "claude-sonnet-5-5", tokensIn: 1000, tokensOut: 50 });
    });

    it("TS-58: a turn with two tool calls streams only text, buttons and done — never tool names, inputs or results", async () => {
        await mysql.license.create({ data: { key: "standard", name: "Standard", priceEgp: 12000, order: 1 } });
        const { evs } = await start("I want the Standard plan", [
            reply("Let me check. ", [
                { id: "t1", name: "list_plans", input: { product: "academy" } },
                { id: "t2", name: "start_checkout", input: { product: "academy", tier: "standard", cycle: "annual" } },
            ]),
            reply("Here is your checkout button."),
        ]);
        expect(evs.map((e) => e.event)).toEqual(["meta", ...Array(evs.length - 4).fill("delta"), "action", "action", "done"]);
        expect(evs.filter((e) => e.event === "action").map((e) => e.data.url)).toEqual(["/en/pricing", "/en/build-product?tier=standard&cycle=annual"]);
        const raw = JSON.stringify(evs);
        expect(raw).not.toMatch(/list_plans|start_checkout|priceEgp|12000/);
        // The second model call saw the tool results.
        const second = llm.stream.mock.calls[1][0] as { messages: { role: string }[] };
        expect(second.messages.at(-1)!.role).toBe("tool_results");
    });

    it("TS-07 / FR-A6: 7 tool calls in one turn → only 6 run and a fallback reply is stored", async () => {
        const calls = Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, name: "get_working_hours", input: {} }));
        const { evs, id } = await start("hours?", [reply("", calls)]);
        expect(await mongo.toolAudit.count({ where: { tool: "get_working_hours" } })).toBe(6);
        expect(llm.stream).toHaveBeenCalledTimes(1);
        const saved = await mongo.chatMessage.findFirst({ where: { conversationId: id, role: "assistant" } });
        expect(saved!.content).toMatch(/couldn't complete/);
        expect(evs.at(-1)!.event).toBe("done");
    });

    it("TS-05 / AC-09.1: a model error ends the stream with error model_unavailable and the fallback links", async () => {
        const { evs, id } = await start("hi", [async () => { throw new Error("529 overloaded"); }]);
        expect(evs.at(-1)).toEqual({ event: "error", data: { code: "model_unavailable", fallback: { whatsapp: "https://wa.me/201000000000", contactUrl: "/en/contact" } } });
        expect(await mongo.chatMessage.count({ where: { conversationId: id, role: "assistant" } })).toBe(0);
    });

    it("TS-05: a model that hangs past the 30 s turn timeout is aborted with the same fallback", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        script.steps.push((req) => new Promise((_, reject) => req.signal!.addEventListener("abort", () => reject(new Error("aborted")))));
        const pending = post({ message: "hi", locale: "en" }).then(events);
        await vi.advanceTimersByTimeAsync(30_000);
        const evs = await pending;
        expect(evs.at(-1)).toMatchObject({ event: "error", data: { code: "model_unavailable" } });
    });

    it("TS-50 / AC-12.3: if a person takes over while the reply streams, the reply is discarded and the stream ends with handoff", async () => {
        const { id, cookie } = await start();
        script.steps.push(async (_req, onText) => {
            onText("Partial answer ");
            await takeOver(id, "staff-1");
            onText("that must never be saved");
            return { text: "Partial answer that must never be saved", toolCalls: [], stopReason: "end", usage: USAGE, model: "claude-sonnet-5-5", raw: [] };
        });
        const evs = await events(await post({ conversationId: id, message: "and pricing?", locale: "en" }, cookie));
        expect(evs.slice(-2)).toEqual([{ event: "handoff", data: { status: "human", message: "" } }, { event: "done", data: { messageId: null } }]);
        const assistant = await mongo.chatMessage.findMany({ where: { conversationId: id, role: "assistant" } });
        expect(assistant.map((m) => m.content)).toEqual(["Hi! How can I help?"]);
    });

    it("TS-08 / AC-12.1: while a person owns it, the message is stored, staff are notified, and the model is not called", async () => {
        const { id, cookie } = await start();
        await takeOver(id, "staff-1");
        llm.stream.mockClear();
        const evs = await events(await post({ conversationId: id, message: "hello?", locale: "en" }, cookie));
        expect(evs.map((e) => e.event)).toEqual(["meta", "done"]);
        expect(evs[0].data.status).toBe("human");
        expect(llm.stream).not.toHaveBeenCalled();
        expect(await mongo.chatMessage.count({ where: { conversationId: id, role: "visitor" } })).toBe(2);
        expect(notifyTelegram).toHaveBeenCalledWith(expect.stringContaining(`/dashboard/conversations/${id}`));
    });

    it("TS-52 / AC-06.4: a tender goes to a person before any model call", async () => {
        const evs = await events(await post({ message: "عندنا مناقصة حكومية لمنصة تعليمية", locale: "ar" }));
        expect(llm.stream).not.toHaveBeenCalled();
        expect(evs.map((e) => e.event)).toEqual(["meta", "handoff", "done"]);
        const conv = await mongo.conversation.findUnique({ where: { id: evs[0].data.conversationId as string } });
        expect(conv!.status).toBe("waiting_human");
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
    });

    it("§13.7: a second message while a turn runs → 409 conversation_busy", async () => {
        const { id, cookie } = await start();
        await mongo.conversation.update({ where: { id }, data: { turnLockUntil: new Date(Date.now() + 60_000) } });
        const res = await post({ conversationId: id, message: "again", locale: "en" }, cookie);
        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({ error: "conversation_busy" });
    });

    it("a closed conversation → 409 conversation_closed", async () => {
        const { id, cookie } = await start();
        await mongo.conversation.update({ where: { id }, data: { status: "closed" } });
        expect((await post({ conversationId: id, message: "x", locale: "en" }, cookie)).status).toBe(409);
    });
});

describe("conversation ownership (NFR-20, TS-03, TS-42, AC-01.5)", () => {
    it("another browser's cookie or no cookie → 404 on chat, history, handoff and rating, without revealing the conversation", async () => {
        const { id } = await start();
        const other = cookieOf(await config(get("/api/agent/config?locale=en&page=/en") as never));
        expect(other).toMatch(/^agent_session=/);
        for (const cookie of [other, undefined]) {
            const c = await post({ conversationId: id, message: "show me", locale: "en" }, cookie);
            expect(c.status).toBe(404);
            expect(await c.json()).toEqual({ error: "conversation_not_found", message: "Conversation not found." });
            expect((await history(get(`/api/agent/conversations/${id}`, cookie), { params: { id } })).status).toBe(404);
            expect((await handoff(new Request("http://l/h", { method: "POST", headers: cookie ? { cookie } : {} }), { params: { id } })).status).toBe(404);
            expect((await rating(new Request("http://l/r", { method: "POST", body: JSON.stringify({ rating: 1 }), headers: cookie ? { cookie } : {} }), { params: { id } })).status).toBe(404);
        }
        // An unknown id looks exactly the same.
        expect((await history(get(`/api/agent/conversations/${"f".repeat(24)}`, other), { params: { id: "f".repeat(24) } })).status).toBe(404);
    });

    it("a forged cookie for the right session id is rejected", async () => {
        const { id, cookie } = await start();
        const forged = cookie.replace(/\.[^.]+$/, ".AAAA");
        expect((await history(get(`/api/agent/conversations/${id}`, forged), { params: { id } })).status).toBe(404);
    });
});

describe("reply language follows the visitor, not the page (bug: Arabic chat on /en got an English handoff)", () => {
    it("an Arabic speaker on /en whose turn ends in a handoff gets the handoff text in Arabic", async () => {
        const { id, cookie } = await start("ممكن نتكلم عربي", [reply("أكيد، نتكلم عربي.")]);
        script.steps.push(reply("", [{ id: "h1", name: "handoff_to_human", input: { reason: "custom quote", summary: "Dedicated server + DRM" } }]));
        const evs = await events(await post({ conversationId: id, message: "انا عاوز سيرفر خاص وعاوز DRM وحماية فيديوهات", locale: "en", page: "/en" }, cookie));
        const handoff = evs.find((e) => e.event === "handoff")!;
        expect(handoff.data.message).toMatch(/[؀-ۿ]/);
        expect(handoff.data.message).not.toMatch(/I've passed/);
        const saved = await mongo.chatMessage.findMany({ where: { conversationId: id, role: "assistant" }, orderBy: { createdAt: "asc" } });
        expect(saved.at(-1)!.content).toMatch(/[؀-ۿ]/);
        expect((await mongo.conversation.findUnique({ where: { id } }))!.locale).toBe("ar");
    });

    it("the model is told the visitor's language, and a short message keeps the conversation's language", async () => {
        const { id, cookie } = await start("عاوز اعرف اسعار المنصات", [reply("تمام")]);
        let ctx = "";
        script.steps.push(async (req, onText) => { ctx = (req as unknown as { systemVolatile: string }).systemVolatile; onText("👍"); return { text: "👍", toolCalls: [], stopReason: "end", usage: USAGE, model: "m", raw: [] }; });
        await events(await post({ conversationId: id, message: "ok 👍", locale: "en" }, cookie)); // too short to tell
        expect(ctx).toContain("Visitor's language: Arabic");
        expect((await mongo.conversation.findUnique({ where: { id } }))!.locale).toBe("ar");
    });

    it("\"Talk to a person\" answers in the language the visitor used", async () => {
        const { id, cookie } = await start("عندي سؤال عن الباقات", [reply("اتفضل")]);
        const res = await handoff(new Request("http://l/h", { method: "POST", headers: { cookie } }), { params: { id } });
        expect((await res.json()).nextReply).toMatch(/[؀-ۿ]/);
    });

    it("an English speaker on /ar is answered in English", async () => {
        script.steps.push(reply("", [{ id: "h2", name: "handoff_to_human", input: { reason: "asked", summary: "wants a person" } }]));
        const res = await post({ message: "Can I talk to a real person please?", locale: "ar", page: "/ar" });
        const handoffEv = (await events(res)).find((e) => e.event === "handoff")!;
        expect(handoffEv.data.message).toMatch(/team/i);
    });
});

describe("history, handoff and rating endpoints", () => {
    it("TS-18 / AC-07.1: history returns visitor-visible messages only, and only newer ones after an id", async () => {
        await mysql.license.create({ data: { key: "basic", name: "Basic", priceEgp: 1 } });
        const { id, cookie } = await start("plans?", [reply("One sec", [{ id: "t", name: "list_plans", input: { product: "academy" } }]), reply("Basic is 1 EGP.")]);
        const all = await (await history(get(`/api/agent/conversations/${id}`, cookie), { params: { id } })).json();
        expect(all.messages.map((m: { role: string }) => m.role)).toEqual(["visitor", "assistant"]);
        expect(JSON.stringify(all)).not.toContain("list_plans");
        const after = await (await history(get(`/api/agent/conversations/${id}?after=${all.messages[0].id}`, cookie), { params: { id } })).json();
        expect(after.messages).toHaveLength(1);
        expect(after.messages[0].content).toBe("One sec\n\nBasic is 1 EGP.");
    });

    it("TS-16 / AC-06.1: Talk to a person → waiting_human + one Telegram alert; a second press → 409", async () => {
        const { id, cookie } = await start();
        const req = () => new Request("http://l/h", { method: "POST", headers: { cookie } });
        const first = await handoff(req(), { params: { id } });
        expect(first.status).toBe(200);
        expect(await first.json()).toMatchObject({ status: "waiting_human" });
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
        expect((await handoff(req(), { params: { id } })).status).toBe(409);
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
    });

    it("FR-W7: rating stores thumbs and comment; invalid values → 400", async () => {
        const { id, cookie } = await start();
        const r = (body: unknown) => rating(new Request("http://l/r", { method: "POST", body: JSON.stringify(body), headers: { cookie } }), { params: { id } });
        expect((await r({ rating: 2 })).status).toBe(400);
        expect((await r({ rating: -1, comment: "x".repeat(501) })).status).toBe(400);
        expect((await r({ rating: -1, comment: "Too slow" })).status).toBe(200);
        expect(await mongo.conversation.findUnique({ where: { id } })).toMatchObject({ rating: -1, ratingComment: "Too slow" });
    });
});

describe("takeover is single-winner (AC-12.4, TS-49 at the state-machine level)", () => {
    it("two staff members taking over at once: exactly one wins", async () => {
        const { id } = await start();
        const [a, b] = await Promise.all([takeOver(id, "staff-a"), takeOver(id, "staff-b")]);
        expect([a, b].filter(Boolean)).toHaveLength(1);
        const conv = await mongo.conversation.findUnique({ where: { id } });
        expect(conv!.assignedTo).toBe(a ? "staff-a" : "staff-b");
        expect(conv!.stateVersion).toBe(1);
    });
});

describe("GET /api/agent/config (E1)", () => {
    it("returns greeting, suggestions, WhatsApp and the page prompt, and hides the widget on the dashboard", async () => {
        const lms = await (await config(get("/api/agent/config?locale=ar&page=/ar/moodle-lms") as never)).json();
        expect(lms).toMatchObject({ enabled: true, hidden: false, greeting: DEFAULT_CONFIG.greeting.ar, whatsapp: "+20 100 000 0000" });
        expect(lms.suggestions).toHaveLength(3);
        expect(lms.proactivePrompt).toMatchObject({ delaySec: 20 });
        const dash = await (await config(get("/api/agent/config?locale=ar&page=/ar/dashboard") as never)).json();
        expect(dash).toMatchObject({ hidden: true, proactivePrompt: null });
    });
});
