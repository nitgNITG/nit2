import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, notifyTelegram } = vi.hoisted(() => {
    process.env.CREDENTIAL_SECRET = "test-credential-secret"; // secretBox reads it at import
    return {
        mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
        mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
        getCurrentUser: vi.fn(),
        notifyTelegram: vi.fn(async () => undefined),
    };
});
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => false, sendEmail: vi.fn() }));

import { GET, POST, PUT } from "@/app/api/agent/admin/telegram/route";
import { alertHandoff, alertHotLead } from "@/lib/agent/alerts";

const TOKEN = "123456789:AAH-test_token_value_abcdefghij";
let sent: { url: string; body: Record<string, unknown> | null }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/getUpdates")) {
        return new Response(JSON.stringify({ ok: true, result: [
            { my_chat_member: { chat: { id: -1009, title: "NIT AI Inbox", type: "supergroup" } } },
            { message: { chat: { id: -1009, title: "NIT AI Inbox", type: "supergroup" } } },
            { message: { chat: { id: 42, first_name: "Ahmed", type: "private" } } },
        ] }));
    }
    return new Response(JSON.stringify({ ok: true }));
});
const admin = { id: "adm", email: "a@x", name: "A", role: "admin" as const };
const put = (body: unknown) => PUT(new Request("http://l/x", { method: "PUT", body: JSON.stringify(body) }));
const post = (body: unknown) => POST(new Request("http://l/x", { method: "POST", body: JSON.stringify(body) }));
const handoff = () => alertHandoff({ conversationId: "c".repeat(24), reason: "asked", summary: "wants a quote", mode: "sales", email: false });

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    sent = [];
    vi.stubGlobal("fetch", fetchMock);
    getCurrentUser.mockResolvedValue(admin);
});
afterEach(() => vi.unstubAllGlobals());

describe("the AI assistant's own Telegram alerts", () => {
    it("not set up → alerts keep going to the shared SaaS bot", async () => {
        await handoff();
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
        expect(sent).toEqual([]);
        expect(await (await GET()).json()).toMatchObject({ usingShared: true, tokenSet: false });
    });

    it("once token + chat are saved, every AI alert (incl. the ones that also email) goes to that chat, not the SaaS bot", async () => {
        expect((await put({ botToken: TOKEN, chatId: "-1009" })).status).toBe(200);
        const status = await (await GET()).json();
        expect(status).toEqual({ chatId: "-1009", tokenSet: true, usingShared: false, sharedConfigured: expect.any(Boolean), encryptionReady: true });
        expect(JSON.stringify(status)).not.toContain(TOKEN);
        expect((await mysql.platformSetting.findFirst({ where: { key: "ai_agent_telegram" } }))!.value).not.toContain(TOKEN); // stored encrypted

        await handoff();
        await alertHotLead({ conversationId: "c".repeat(24), tier: "HOT", score: 90 });
        expect(notifyTelegram).not.toHaveBeenCalled();
        expect(sent.map((s) => [s.url, s.body?.chat_id])).toEqual([
            [`https://api.telegram.org/bot${TOKEN}/sendMessage`, "-1009"],
            [`https://api.telegram.org/bot${TOKEN}/sendMessage`, "-1009"],
        ]);
        expect(String(sent[1].body?.text)).toContain("HOT lead");

        await put({ chatId: "" }); // empty token keeps it; clearing the chat → back to the shared bot
        await handoff();
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
    });

    it("Find chat ID lists the chats that wrote to the bot (deduplicated); test sends to the AI chat", async () => {
        const r = await (await post({ action: "find_chats", botToken: TOKEN })).json();
        expect(r.chats).toEqual([{ id: "-1009", title: "NIT AI Inbox", type: "supergroup" }, { id: "42", title: "Ahmed", type: "private" }]);

        await put({ botToken: TOKEN, chatId: "-1009" });
        expect(await (await post({ action: "test" })).json()).toEqual({ ok: true, target: "agent" });
    });

    it("validates input and is admin-only", async () => {
        expect((await put({ botToken: "nope", chatId: "-1009" })).status).toBe(400);
        expect((await put({ chatId: "abc" })).status).toBe(400);
        getCurrentUser.mockResolvedValue({ id: "s1", email: "s@x", name: null, role: "client" });
        expect((await GET()).status).toBe(403);
    });
});
