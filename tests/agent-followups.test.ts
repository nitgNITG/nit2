import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, sendEmail, notifyTelegram, llm } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
    sendEmail: vi.fn(async () => undefined),
    notifyTelegram: vi.fn(async () => undefined),
    llm: {
        stream: vi.fn(),
        complete: vi.fn(async () => ({ text: "Following up on your LMS for 300 employees — would a short call this week suit you?", toolCalls: [], stopReason: "end", usage: { inputTokens: 100, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5-20251001", raw: [] })),
        estimateInputTokens: vi.fn(() => 200),
    },
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => true, sendEmail }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins: vi.fn(), supportWhatsapp: async () => "", adminAlertEmails: async () => [] }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { createFollowUpDrafts, toE164Phone, mayContact } from "@/lib/agent/followups";
import { runDailyMaintenance } from "@/lib/agent/maintenance";
import { PATCH as decide } from "@/app/api/agent/admin/messages/[id]/route";
import { GET as list } from "@/app/api/agent/admin/followups/route";
import { PATCH as editLead } from "@/app/api/agent/admin/leads/[id]/route";
import { GET as history } from "@/app/api/agent/conversations/[id]/route";

const NOW = new Date("2026-10-12T07:00:00Z"); // Monday 10:00 Cairo
const H = 3600_000;
const cfg = { ...DEFAULT_CONFIG, dailyBudgetUsd: 5 };
const admin = { id: "adm", email: "a@x", name: "Admin", role: "admin" as const };

let graph: { to: string; type: string; text?: string; template?: { name: string; language: { code: string }; components?: { parameters: { text: string }[] }[] } }[] = [];
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!url.startsWith("https://graph.facebook.com/")) throw new Error(`unexpected fetch ${url}`);
    const b = JSON.parse(String(init?.body));
    graph.push({ to: b.to, type: b.type, text: b.text?.body, template: b.template });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }));
});

async function lead(data: Record<string, unknown>) {
    return mongo.contact.create({ data: { name: "Sara Ali", email: "", subject: "AI chat", message: "x", sourcePage: "chat", status: "new", ...data } });
}
async function chat(contactId: string, data: Record<string, unknown> = {}) {
    const c = await mongo.conversation.create({ data: { channel: "web", mode: "sales", status: "closed", locale: "en", contactId, lastMessageAt: new Date(NOW.getTime() - 30 * H), messageCount: 4, ...data } });
    await mongo.chatMessage.create({ data: { conversationId: c.id, role: "visitor", content: "I need an LMS", createdAt: new Date(NOW.getTime() - 30 * H) } });
    return c;
}
const drafts = async () => mongo.chatMessage.findMany({ where: { status: "draft" } });
const patch = (id: string, body: unknown) => decide(new Request("http://l/x", { method: "PATCH", body: JSON.stringify(body) }), { params: { id } });

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    graph = [];
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(process.env, { WHATSAPP_PHONE_NUMBER_ID: "1111", WHATSAPP_ACCESS_TOKEN: "t", NEXT_PUBLIC_BASE_URL: "https://dev.nitg-eg.com" });
    getCurrentUser.mockResolvedValue(admin);
    vi.useFakeTimers({ toFake: ["Date"] }); // routes use "now"; keep it at NOW
    vi.setSystemTime(NOW);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("who may be contacted (FR-F5)", () => {
    it("chat leads need an explicit yes; form leads asked to be contacted; a no is final", () => {
        expect(mayContact({ consentContact: null, sourcePage: "chat" })).toBe(false);
        expect(mayContact({ consentContact: true, sourcePage: "whatsapp" })).toBe(true);
        expect(mayContact({ consentContact: null, sourcePage: "/contact" })).toBe(true);
        expect(mayContact({ consentContact: false, sourcePage: "/contact" })).toBe(false);
    });

    it("numbers become E.164 (Egyptian local numbers completed); unknown formats are not guessed", () => {
        expect(toE164Phone("010 0123 4567", "eg")).toBe("+201001234567");
        expect(toE164Phone("00966501234567")).toBe("+966501234567");
        expect(toE164Phone("+201001234567")).toBe("+201001234567");
        expect(toE164Phone("0501234567", "sa")).toBeNull();
    });
});

describe("daily drafts (E18, FR-F1, FR-F2, FR-F4)", () => {
    it("TS-41 / AC-32.1: a visitor who left a number but declined (or never answered) gets no draft; with consent, exactly one draft", async () => {
        const declined = await lead({ phone: "+201001111111", consentContact: false });
        const silent = await lead({ phone: "+201002222222", consentContact: null });
        const yes = await lead({ phone: "+201003333333", consentContact: true, consentAt: new Date() });
        for (const l of [declined, silent, yes]) await chat(l.id as string);

        const r = await createFollowUpDrafts(cfg, NOW);
        expect(r).toMatchObject({ abandoned: 1 });
        const d = await drafts();
        expect(d).toHaveLength(1);
        expect(d[0].followup).toMatchObject({ kind: "abandoned", channel: "whatsapp", to: "+201003333333", contactId: yes.id });
        expect(d[0].content).toMatch(/^Hi Sara, /);
        expect(graph).toEqual([]); // drafted, never sent

        await createFollowUpDrafts(cfg, NOW); // the next run doesn't repeat it
        expect(await drafts()).toHaveLength(1);
    });

    it("FR-F4: no draft when a person already handled the chat, or it's too recent", async () => {
        const a = await lead({ phone: "+201003333333", consentContact: true });
        await chat(a.id as string, { assignedTo: "s1" });
        const b = await lead({ phone: "+201004444444", consentContact: true });
        await chat(b.id as string, { lastMessageAt: new Date(NOW.getTime() - 5 * H) });
        expect((await createFollowUpDrafts(cfg, NOW)).abandoned).toBe(0);
    });

    it("AC-22.1: a lead whose follow-up date is today gets a draft (by email when there's no number); won/lost leads don't", async () => {
        const due = await lead({ name: "Omar", email: "omar@acme.com", sourcePage: "/contact", nextFollowUpAt: new Date("2026-10-12T06:00:00Z") });
        await lead({ email: "x@acme.com", sourcePage: "/contact", status: "won", nextFollowUpAt: new Date("2026-10-12T06:00:00Z") });
        await lead({ email: "y@acme.com", sourcePage: "/contact", nextFollowUpAt: new Date("2026-10-13T06:00:00Z") }); // tomorrow
        expect(await createFollowUpDrafts(cfg, NOW)).toMatchObject({ due: 1 });
        const [d] = await drafts();
        expect(d.followup).toMatchObject({ kind: "due", channel: "email", to: "omar@acme.com", contactId: due.id });
        expect(d.content).toContain("LMS for 300 employees");
        expect(sendEmail).not.toHaveBeenCalled();
        expect(await mongo.agentUsageEvent.findFirst()).toMatchObject({ kind: "followup", model: "claude-haiku-4-5-20251001" });
    });

    it("FR-F2: a checkout link from chat not paid after 48 h → draft; paid meanwhile or too recent → none", async () => {
        const unpaid = await lead({ phone: "+201005555555", consentContact: true, email: "pay@acme.com" });
        const c1 = await chat(unpaid.id as string, { lastMessageAt: new Date(NOW.getTime() - 2 * H) }); // recent chat: not "abandoned"
        await mongo.toolAudit.create({ data: { conversationId: c1.id, turnId: "t", tool: "start_checkout", argsRedacted: { product: "academy", tier: "standard", cycle: "annual" }, status: "ok", latencyMs: 1, createdAt: new Date(NOW.getTime() - 50 * H) } });

        const paidLead = await lead({ phone: "+201006666666", consentContact: true, email: "paid@acme.com" });
        const c2 = await chat(paidLead.id as string, { lastMessageAt: new Date(NOW.getTime() - 2 * H) });
        await mongo.toolAudit.create({ data: { conversationId: c2.id, turnId: "t", tool: "start_checkout", argsRedacted: { product: "academy", tier: "pro" }, status: "ok", latencyMs: 1, createdAt: new Date(NOW.getTime() - 50 * H) } });
        await mysql.user.create({ data: { id: "u-paid", email: "paid@acme.com", password: "x" } });
        await mysql.payment.create({ data: { orderId: "o1", userId: "u-paid", licenseKey: "pro", amount: 100, status: "paid", createdAt: new Date(NOW.getTime() - 40 * H) } });

        const recent = await lead({ phone: "+201007777777", consentContact: true });
        const c3 = await chat(recent.id as string, { lastMessageAt: new Date(NOW.getTime() - 2 * H) });
        await mongo.toolAudit.create({ data: { conversationId: c3.id, turnId: "t", tool: "start_checkout", argsRedacted: {}, status: "ok", latencyMs: 1, createdAt: new Date(NOW.getTime() - 10 * H) } });

        expect(await createFollowUpDrafts(cfg, NOW)).toMatchObject({ checkout: 1 });
        expect((await drafts())[0].followup).toMatchObject({ kind: "checkout", contactId: unpaid.id, plan: "academy standard" });
    });

    it("the daily job (E18) reports the drafts and sends one Telegram note; maxPerRun caps the work", async () => {
        for (let i = 0; i < 3; i++) await chat((await lead({ phone: `+20100888888${i}`, consentContact: true })).id as string);
        const r = await runDailyMaintenance({ ...cfg, followups: { ...cfg.followups, maxPerRun: 2 } }, NOW);
        expect(r.drafts).toBe(2);
        expect(notifyTelegram).toHaveBeenCalledWith(expect.stringContaining("2 follow-up drafts waiting for approval"));
    });
});

describe("approve & send / discard (E17, FR-F3, TS-28, AC-22.2)", () => {
    async function oneDraft(data: Record<string, unknown> = {}) {
        const l = await lead({ phone: "+201003333333", consentContact: true, ...data });
        await chat(l.id as string);
        await createFollowUpDrafts(cfg, NOW);
        return { lead: l, draft: (await drafts())[0] };
    }

    it("AC-22.2: approving sends it on the lead's channel (template outside the 24 h window), logs an Activity, marks the lead contacted", async () => {
        const { lead: l, draft } = await oneDraft();
        const res = await patch(draft.id as string, { action: "send", content: "Hi Sara, would a short call on Tuesday work?" });
        expect(res.status).toBe(200);
        expect(graph).toHaveLength(1);
        expect(graph[0]).toMatchObject({ to: "201003333333", type: "template", template: { name: "nit_followup", language: { code: "en" } } });
        expect(graph[0].template!.components![0].parameters.map((p) => p.text)).toEqual(["Sara", "would a short call on Tuesday work?"]);
        const sent = (await mongo.chatMessage.findUnique({ where: { id: draft.id as string } }))!;
        expect(sent).toMatchObject({ status: "sent", staffId: "adm", content: "Hi Sara, would a short call on Tuesday work?" });
        expect(sent.followup).toMatchObject({ via: "template", decidedBy: "adm" });
        expect((await mongo.contact.findUnique({ where: { id: l.id as string } }))!.status).toBe("contacted");
        expect(await mongo.activity.findFirst({ where: { event: "AI_FOLLOWUP_APPROVED" } })).toMatchObject({ createdBy: "adm" });

        // TS-28: not a draft any more → 409
        expect((await patch(draft.id as string, { action: "send" })).status).toBe(409);
        expect(graph).toHaveLength(1);
    });

    it("inside the 24-hour WhatsApp window it goes as plain text", async () => {
        const l = await lead({ phone: "+201003333333", consentContact: true });
        const c = await mongo.conversation.create({ data: { channel: "whatsapp", phoneE164: "+201003333333", mode: "sales", status: "closed", locale: "ar", contactId: l.id, lastMessageAt: new Date(NOW.getTime() - 30 * H) } });
        await mongo.chatMessage.create({ data: { conversationId: c.id, role: "visitor", content: "مرحبا", createdAt: new Date(Date.now() - 2 * H) } });
        await createFollowUpDrafts(cfg, NOW);
        const [d] = await drafts();
        expect(d.content).toMatch(/^مرحباً Sara،/);
        await patch(d.id as string, { action: "send" });
        expect(graph[0]).toMatchObject({ type: "text", to: "201003333333" });
    });

    it("discard never sends; two people clicking at once → only one wins", async () => {
        const { draft } = await oneDraft();
        const [a, b] = await Promise.all([patch(draft.id as string, { action: "send" }), patch(draft.id as string, { action: "discard" })]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(graph.length).toBeLessThanOrEqual(1);

        const { draft: d2 } = await oneDraft({ phone: "+201009999999" });
        expect((await patch(d2.id as string, { action: "discard" })).status).toBe(200);
        expect((await mongo.chatMessage.findUnique({ where: { id: d2.id as string } }))!.status).toBe("discarded");
    });

    it("refuses safely: no template configured, consent withdrawn — the draft stays a draft", async () => {
        const { lead: l, draft } = await oneDraft();
        const noTemplate = { ...DEFAULT_CONFIG, followups: { ...DEFAULT_CONFIG.followups, whatsappTemplate: { name: "", languageAr: "ar", languageEn: "en" } } };
        await mysql.platformSetting.create({ data: { key: "ai_agent_config", value: JSON.stringify({ ...noTemplate, version: 1 }) } });
        const r1 = await patch(draft.id as string, { action: "send" });
        expect([r1.status, (await r1.json()).error]).toEqual([409, "template_missing"]);
        expect((await mongo.chatMessage.findUnique({ where: { id: draft.id as string } }))!.status).toBe("draft");

        await mysql.platformSetting.deleteMany({ where: { key: "ai_agent_config" } });
        await mongo.contact.update({ where: { id: l.id as string }, data: { consentContact: false } });
        const r2 = await patch(draft.id as string, { action: "send" });
        expect((await r2.json()).error).toBe("no_consent");
        expect(graph).toEqual([]);
    });

    it("drafts are never shown to the visitor; only admins and sales can approve; the list shows them", async () => {
        const { draft } = await oneDraft();
        expect((await (await list(new Request("http://l/x?status=draft"))).json()).items).toHaveLength(1);
        const conv = (await mongo.conversation.findUnique({ where: { id: draft.conversationId as string } }))!;
        await mongo.conversation.update({ where: { id: conv.id as string }, data: { userId: "client-9" } });
        getCurrentUser.mockResolvedValue({ id: "client-9", email: "c@x", name: null, role: "client" });
        const h = await (await history(new Request("http://l/x"), { params: { id: conv.id as string } })).json();
        expect(h.messages.some((m: { content: string }) => m.content === draft.content)).toBe(false);

        await mysql.user.create({ data: { id: "sup", email: "sup@x", password: "x", agentPermissions: ["support"] } });
        getCurrentUser.mockResolvedValue({ id: "sup", email: "sup@x", name: null, role: "client" });
        expect((await patch(draft.id as string, { action: "send" })).status).toBe(403);
        await mysql.user.create({ data: { id: "s1", email: "mona@x", password: "x", agentPermissions: ["sales"] } });
        getCurrentUser.mockResolvedValue({ id: "s1", email: "mona@x", name: "Mona", role: "client" });
        expect((await patch(draft.id as string, { action: "discard" })).status).toBe(200);
    });
});

describe("next follow-up date on a lead", () => {
    it("sales sets a Cairo day; the daily job drafts that day; null clears it", async () => {
        const l = await lead({ email: "o@acme.com", sourcePage: "/contact" });
        const res = await editLead(new Request("http://l/x", { method: "PATCH", body: JSON.stringify({ nextFollowUpAt: "2026-10-12" }) }), { params: { id: l.id as string } });
        expect(res.status).toBe(200);
        expect((await mongo.contact.findUnique({ where: { id: l.id as string } }))!.nextFollowUpAt).toEqual(new Date("2026-10-12T06:00:00Z")); // 09:00 Cairo (UTC+3)
        expect((await createFollowUpDrafts(cfg, NOW)).due).toBe(1);
        await editLead(new Request("http://l/x", { method: "PATCH", body: JSON.stringify({ nextFollowUpAt: null }) }), { params: { id: l.id as string } });
        expect((await mongo.contact.findUnique({ where: { id: l.id as string } }))!.nextFollowUpAt).toBeNull();
    });
});
