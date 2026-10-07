import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

type Script = (req: { messages: unknown[]; tools?: { name: string }[] }, onText: (d: string) => void) => Promise<unknown>;
const { mongo, mysql, getCurrentUser, llm, script, sendEmail, notifyTelegram } = vi.hoisted(() => {
    const script: { steps: Script[]; seen: { tools: string[]; system: string }[] } = { steps: [], seen: [] };
    return {
        mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
        mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
        getCurrentUser: vi.fn(),
        sendEmail: vi.fn(async (_m: { to: string; text: string }) => undefined),
        notifyTelegram: vi.fn(async () => undefined),
        script,
        llm: {
            stream: vi.fn((req: { tools?: { name: string }[]; systemVolatile?: string }, onText: (d: string) => void) => {
                script.seen.push({ tools: (req.tools ?? []).map((t) => t.name), system: req.systemVolatile ?? "" });
                const step = script.steps.shift();
                if (!step) throw new Error("no scripted model reply left");
                return step(req as never, onText);
            }),
            complete: vi.fn(async () => ({ text: "{}", toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [] })),
            estimateInputTokens: vi.fn(() => 1000),
        },
    };
});
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => true, sendEmail }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins: vi.fn(), supportWhatsapp: async () => "+20 100 000 0000", adminAlertEmails: async () => [] }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { GET as verifyHook, POST as hook } from "@/app/api/agent/whatsapp/webhook/route";
import { POST as staffMessage } from "@/app/api/agent/admin/conversations/[id]/messages/route";
import { inboundIdle } from "@/lib/agent/channels/whatsapp/inbound";
import { parseWebhook, splitText, verifySignature } from "@/lib/agent/channels/whatsapp/cloud";
import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { executeTool, toolsFor } from "@/lib/agent/tools/registry";
import { takeOver } from "@/lib/agent/runtime/state";

const SECRET = "app-secret-for-tests";
const PHONE = "+201001234567";
const USAGE = { inputTokens: 1000, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 };
const reply = (text: string, toolCalls: { id: string; name: string; input: unknown }[] = []): Script => async (_req, onText) => {
    if (text) onText(text);
    return { text, toolCalls, stopReason: toolCalls.length ? "tool_use" : "end", usage: USAGE, model: "claude-sonnet-5-5", raw: [{ type: "text", text }] };
};

let sent: { to: string; text?: string; template?: string }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!url.startsWith("https://graph.facebook.com/")) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init?.body));
    if (body.status === "read") return new Response(JSON.stringify({ success: true }));
    sent.push({ to: body.to, text: body.text?.body, template: body.template?.name });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.out${sent.length}` }] }));
});

let n = 0;
function payload(text: string | null, opts: { id?: string; from?: string; type?: string } = {}) {
    const type = opts.type ?? (text === null ? "image" : "text");
    return {
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "messages", value: {
            metadata: { phone_number_id: "1111" },
            contacts: [{ wa_id: (opts.from ?? PHONE).slice(1), profile: { name: "Sara" } }],
            messages: [{ id: opts.id ?? `wamid.in${++n}`, from: (opts.from ?? PHONE).slice(1), timestamp: String(Math.floor(Date.now() / 1000)), type,
                ...(type === "text" ? { text: { body: text } } : { image: { id: "x" } }) }],
        } }] }],
    };
}
const sign = (raw: string) => `sha256=${crypto.createHmac("sha256", SECRET).update(raw).digest("hex")}`;
async function send(body: unknown, signature?: string) {
    const raw = JSON.stringify(body);
    const res = await hook(new Request("http://localhost/api/agent/whatsapp/webhook", {
        method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": signature ?? sign(raw) }, body: raw,
    }));
    await inboundIdle();
    return res;
}
const wa = (text: string | null, opts?: { id?: string; from?: string }) => send(payload(text, opts));
const conv = async () => (await mongo.conversation.findFirst({ where: { channel: "whatsapp" } }))!;
const rows = async (role: string) => (await mongo.chatMessage.findMany({ where: { role }, orderBy: { createdAt: "asc" } })).map((m) => m.content);

async function setConfig(over: Record<string, unknown> = {}) {
    await mysql.platformSetting.deleteMany({ where: { key: "ai_agent_config" } });
    await mysql.platformSetting.create({ data: { key: "ai_agent_config", value: JSON.stringify({ ...DEFAULT_CONFIG, enabled: { web: true, whatsapp: true }, dailyBudgetUsd: 5, version: 1, ...over }) } });
}

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    script.steps.length = 0;
    script.seen.length = 0;
    sent = [];
    vi.stubGlobal("fetch", fetchMock);
    process.env.WHATSAPP_APP_SECRET = SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1111";
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.NEXT_PUBLIC_BASE_URL = "https://dev.nitg-eg.com";
    getCurrentUser.mockResolvedValue(null);
    await setConfig();
});
afterEach(() => vi.unstubAllGlobals());

describe("webhook (E15 / E16, NFR-5, TS-26)", () => {
    it("the verification handshake echoes the challenge only with our verify token", async () => {
        const ok = await verifyHook(new Request("http://l/x?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"));
        expect([ok.status, await ok.text()]).toEqual([200, "42"]);
        expect((await verifyHook(new Request("http://l/x?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"))).status).toBe(403);
    });

    it("TS-26: a bad or missing signature → 401 and nothing stored; the same message id twice is handled once", async () => {
        expect((await send(payload("hi"), "sha256=" + "0".repeat(64))).status).toBe(401);
        expect((await send(payload("hi"), "")).status).toBe(401);
        expect(await mongo.conversation.count()).toBe(0);

        script.steps.push(reply("Hello! How can I help?"));
        expect((await wa("hi", { id: "wamid.dup" })).status).toBe(200);
        expect((await wa("hi", { id: "wamid.dup" })).status).toBe(200);
        expect(await rows("visitor")).toEqual(["hi"]);
        expect(llm.stream).toHaveBeenCalledTimes(1);
    });

    it("signature check is constant-time HMAC over the raw body; payload parsing keeps only customer messages", () => {
        expect(verifySignature("{}", sign("{}"))).toBe(true);
        expect(verifySignature("{ }", sign("{}"))).toBe(false);
        expect(parseWebhook({ object: "page" }).messages).toEqual([]);
        expect(parseWebhook(payload("hey")).messages[0]).toMatchObject({ from: PHONE, name: "Sara", text: "hey", type: "text" });
        expect(splitText("a".repeat(5000)).map((p) => p.length)).toEqual([4096, 904]);
    });
});

describe("the agent on WhatsApp (FR-WA1–WA3, AC-21.1)", () => {
    it("AC-21.1: a first message gets a reply on WhatsApp and shows in the inbox as a whatsapp conversation; links become full URLs", async () => {
        script.steps.push(reply("", [{ id: "t1", name: "list_plans", input: { product: "academy" } }]), reply("Here are our academy plans."));
        await wa("What are the academy plans?");
        const c = await conv();
        expect(c).toMatchObject({ channel: "whatsapp", phoneE164: PHONE, mode: "sales", status: "open", sourcePage: "whatsapp" });
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ to: PHONE.slice(1) });
        expect(sent[0].text).toContain("Here are our academy plans.");
        expect(script.seen[0].system).toContain("Channel: WhatsApp");
        expect(script.seen[0].tools).toContain("start_account_verification");
    });

    it("FR-WA2: the number fills the lead's WhatsApp (the model never supplies it); a later chat from the number reuses the lead", async () => {
        script.steps.push(reply("", [{ id: "t1", name: "capture_lead", input: { name: "Sara Ali" } }]), reply("Thanks Sara!"));
        await wa("I'm Sara Ali, I need an LMS");
        const lead = (await mongo.contact.findFirst())!;
        expect(lead).toMatchObject({ name: "Sara Ali", whatsapp: PHONE, sourcePage: "whatsapp" });

        await mongo.conversation.update({ where: { id: (await conv()).id as string }, data: { status: "closed" } });
        script.steps.push(reply("Welcome back, Sara!"));
        await wa("Hi again");
        const second = (await mongo.conversation.findFirst({ where: { channel: "whatsapp", status: "open" } }))!;
        expect(second.contactId).toBe(lead.id);
        expect((second.qualification as { lead: { name: string } }).lead.name).toBe("Sara Ali");
    });

    it("images and voice notes get a 'text only' reply; nothing reaches the model", async () => {
        await wa(null);
        expect(await rows("visitor")).toEqual(["[image]"]);
        expect(sent[0].text).toMatch(/text messages only|الرسائل النصية/);
        expect(llm.stream).not.toHaveBeenCalled();
    });

    it("AI off for WhatsApp: the message goes to the team (waiting for a person), no auto-reply", async () => {
        await setConfig({ enabled: { web: true, whatsapp: false } });
        await wa("hello?");
        expect((await conv()).status).toBe("waiting_human");
        expect(sent).toEqual([]);
        expect(llm.stream).not.toHaveBeenCalled();
        expect(notifyTelegram).toHaveBeenCalled();
    });

    it("start_account_verification exists only on WhatsApp", async () => {
        expect(toolsFor("sales", "web").map((t) => t.name)).not.toContain("start_account_verification");
        expect(toolsFor("sales", "whatsapp").map((t) => t.name)).toContain("start_account_verification");
        const r = await executeTool({
            conversationId: "c".repeat(24), turnId: "t", mode: "sales", channel: "web", locale: "en", userId: null, sessionId: null,
            config: DEFAULT_CONFIG, now: new Date(), actions: [], handoff: null, afterTurn: [],
        }, "start_account_verification", { email: "a@b.com" }, "tu1");
        expect(r).toMatchObject({ ok: false, code: "not_authorized" });
    });
});

describe("account verification by email code (FR-WA5, §13.15, TS-53, TS-54, AC-34)", () => {
    const codeFromEmail = () => /(\d{6})/.exec((sendEmail.mock.calls.at(-1)![0] as { text: string }).text)![1];
    async function askAccount(email: string) {
        script.steps.push(reply("", [{ id: `v${++n}`, name: "start_account_verification", input: { email } }]), reply("If this email has an account, a code was sent. Type it here."));
        await wa("When does my academy expire?");
    }

    beforeEach(async () => {
        await mysql.user.create({ data: { id: "client-1", email: "owner@acme.com", password: "x", name: "Owner" } });
    });

    it("AC-34.1: the same answer whether or not the email has an account; a code is emailed only when it does", async () => {
        await askAccount("nobody@acme.com");
        expect(sendEmail).not.toHaveBeenCalled();
        const first = sent.at(-1)!.text;
        await askAccount("owner@acme.com");
        expect(sendEmail).toHaveBeenCalledTimes(1);
        expect(sent.at(-1)!.text).toBe(first);
    });

    it("TS-53: the right code links the number for 90 days and switches to support mode; the code is never stored or sent to the model", async () => {
        await askAccount("owner@acme.com");
        const code = codeFromEmail();
        const calls = llm.stream.mock.calls.length;
        await wa(code.split("").join(" "));
        expect(llm.stream.mock.calls.length).toBe(calls); // no model call
        const id = (await mongo.whatsAppIdentity.findFirst())!;
        expect(id).toMatchObject({ phoneE164: PHONE, userId: "client-1" });
        expect((id.expiresAt as Date).getTime() - Date.now()).toBeGreaterThan(89 * 86_400_000);
        expect(await mongo.chatMessage.count({ where: { content: { contains: code } } }).catch(async () =>
            (await mongo.chatMessage.findMany({})).filter((m) => String(m.content).includes(code)).length)).toBe(0);
        expect(sent.at(-1)!.text).toMatch(/linked|ربط/);

        script.steps.push(reply("Your academy renews on 1 Dec."));
        await wa("When does my academy expire?");
        expect(await conv()).toMatchObject({ mode: "support", userId: "client-1" });
        expect(script.seen.at(-1)!.tools).toContain("get_my_tenants");
        expect(script.seen.at(-1)!.system).toContain("Account linked to this WhatsApp number: yes");
    });

    it("TS-54: wrong codes are refused; after 5 the code is dead and the client must start again; support tools stay locked", async () => {
        await askAccount("owner@acme.com");
        const good = codeFromEmail();
        const bad = good === "000000" ? "111111" : "000000";
        for (let i = 0; i < 5; i++) await wa(bad);
        expect(sent.at(-1)!.text).toMatch(/isn't right|غير صحيح/);
        await wa(good); // 6th try: locked even with the right code
        expect(sent.at(-1)!.text).toMatch(/expired|انتهت/);
        expect(await mongo.whatsAppIdentity.count()).toBe(0);

        script.steps.push(reply("I can't see account details yet."));
        await wa("show my payments");
        expect(script.seen.at(-1)!.tools).not.toContain("get_payments");
    });

    it("a phone alone never identifies an account: an expired link is back to sales mode", async () => {
        await mongo.whatsAppIdentity.create({ data: { phoneE164: PHONE, userId: "client-1", verifiedAt: new Date(Date.now() - 91 * 86_400_000), expiresAt: new Date(Date.now() - 86_400_000) } });
        script.steps.push(reply("Hi!"));
        await wa("hello");
        expect(await conv()).toMatchObject({ mode: "sales", userId: null });
    });
});

describe("a person on WhatsApp (FR-WA4, FR-H3)", () => {
    const staff = { id: "adm", email: "a@x", name: "Admin", role: "admin" as const };
    const postStaff = (id: string, content: string) =>
        staffMessage(new Request("http://l/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }), { params: { id } });

    it("while a person owns it the AI stays silent; the person's reply is sent on WhatsApp", async () => {
        script.steps.push(reply("Hi!"));
        await wa("hello");
        const c = await conv();
        await takeOver(c.id as string, "adm");
        sent = [];
        await wa("are you there?");
        expect(llm.stream).toHaveBeenCalledTimes(1);
        expect(sent).toEqual([]);

        getCurrentUser.mockResolvedValue(staff);
        const res = await postStaff(c.id as string, "Yes, this is Mona from N.I.T");
        expect(res.status).toBe(200);
        expect(sent).toEqual([{ to: PHONE.slice(1), text: "Yes, this is Mona from N.I.T", template: undefined }]);
    });

    it("FR-WA3: outside the 24-hour window a free-text reply is refused", async () => {
        script.steps.push(reply("Hi!"));
        await wa("hello");
        const c = await conv();
        await takeOver(c.id as string, "adm");
        const v = (await mongo.chatMessage.findFirst({ where: { role: "visitor" } }))!;
        await mongo.chatMessage.update({ where: { id: v.id as string }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
        getCurrentUser.mockResolvedValue(staff);
        sent = [];
        const res = await postStaff(c.id as string, "Following up");
        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({ error: "whatsapp_window_closed" });
        expect(sent).toEqual([]);
    });
});

describe("linking the app to the WhatsApp account (settings card)", () => {
    it("shows which apps the account delivers to and links ours with one click (admin only)", async () => {
        const { GET: status, POST: action } = await import("@/app/api/agent/admin/whatsapp/route");
        process.env.WHATSAPP_WABA_ID = "2222";
        let subscribed = false;
        const calls: string[] = [];
        vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
            calls.push(`${init?.method ?? "GET"} ${url}`);
            if (url.endsWith("/2222/subscribed_apps") && init?.method === "POST") { subscribed = true; return new Response(JSON.stringify({ success: true })); }
            if (url.endsWith("/2222/subscribed_apps")) return new Response(JSON.stringify({ data: subscribed ? [{ whatsapp_business_api_data: { id: "285", name: "WA_nit" } }] : [] }));
            throw new Error(`unexpected ${url}`);
        }));
        getCurrentUser.mockResolvedValue({ id: "adm", email: "a@x", name: "A", role: "admin" });
        expect((await (await status()).json()).subscription).toEqual({ ok: true, apps: [] });

        const r = await action(new Request("http://l/x", { method: "POST", body: JSON.stringify({ action: "subscribe" }) }));
        expect(await r.json()).toMatchObject({ subscribed: true, subscription: { ok: true, apps: [{ name: "WA_nit" }] } });
        expect(calls).toContain("POST https://graph.facebook.com/v23.0/2222/subscribed_apps");

        getCurrentUser.mockResolvedValue({ id: "c1", email: "c@x", name: null, role: "client" });
        expect((await action(new Request("http://l/x", { method: "POST", body: JSON.stringify({ action: "subscribe" }) }))).status).toBe(403);
        delete process.env.WHATSAPP_WABA_ID;
    });
});
