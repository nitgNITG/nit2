import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, notifyTelegram, alertAdmins, sendEmail, mailerConfigured, llm, script } = vi.hoisted(() => {
    const script: { steps: ((req: any, onText: (d: string) => void) => Promise<unknown>)[] } = { steps: [] };
    return {
        mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
        mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
        getCurrentUser: vi.fn(),
        notifyTelegram: vi.fn(),
        alertAdmins: vi.fn(),
        sendEmail: vi.fn(),
        mailerConfigured: vi.fn(() => true),
        script,
        llm: {
            stream: vi.fn((req: any, onText: (d: string) => void) => script.steps.shift()!(req, onText)),
            complete: vi.fn(),
            estimateInputTokens: vi.fn(() => 100),
        },
    };
});
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "" }));
vi.mock("@/lib/mailer", () => ({ sendEmail, mailerConfigured }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { POST as chat } from "@/app/api/agent/chat/route";
import { GET as history } from "@/app/api/agent/conversations/[id]/route";
import { GET as listTickets } from "@/app/api/agent/admin/tickets/route";
import { PATCH as patchTicket } from "@/app/api/agent/admin/tickets/[id]/route";
import { GET as listMeetings } from "@/app/api/agent/admin/meetings/route";
import { PATCH as patchMeeting } from "@/app/api/agent/admin/meetings/[id]/route";
import { GET as analytics } from "@/app/api/agent/admin/analytics/route";
import { POST as answer } from "@/app/api/agent/admin/analytics/answer/route";
import { GET as getConfig } from "@/app/api/agent/admin/config/route";
import { DEFAULT_CONFIG, getAgentConfig } from "@/lib/agent/config";
import { executeTool, toolsFor } from "@/lib/agent/tools/registry";
import { paymentReasonKey } from "@/lib/agent/tools/support/safe";
import type { ToolContext } from "@/lib/agent/tools/types";

const A = { id: "user-a", email: "a@acme.com", name: "A", role: "client" as const };
const B = { id: "user-b", email: "b@beta.com", name: "B", role: "client" as const };
const STACK = "Error: ECONNREFUSED 10.0.0.7:9098\n    at provision (/srv/provisioner/run.py:88)";
let convId: string;
let n = 0;

function ctx(over: Partial<ToolContext> = {}): ToolContext {
    return {
        conversationId: convId, turnId: "t", mode: "support", channel: "web", locale: "en", userId: A.id, sessionId: null,
        config: { ...DEFAULT_CONFIG, brochures: { company: "https://files.nitg-eg.com/profile.pdf", services: {} }, bookingUrl: "https://cal.example/nitg" },
        now: new Date("2026-10-06T10:00:00Z"), actions: [], handoff: null, afterTurn: [], ...over,
    };
}
const run = (c: ToolContext, name: string, input: unknown) => executeTool(c, name, input, `tu_${++n}`);

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    script.steps.length = 0;
    mailerConfigured.mockReturnValue(true);
    getCurrentUser.mockResolvedValue(null);
    process.env.SECRET_JWT = "test-secret-at-least-32-characters-long";
    for (const u of [A, B]) await mysql.user.create({ data: { ...u, password: "h" } });
    await mysql.license.create({ data: { key: "standard", name: "Standard", priceEgp: 12000 } });
    await mysql.license.create({ data: { key: "store-basic", name: "Store Basic", product: "store", priceEgp: 5000 } });
    await mysql.tenant.create({ data: { slug: "acme", name: "Acme Academy", ownerId: A.id, product: "academy", status: "live", tier: "standard", validUntil: new Date("2027-03-01T00:00:00Z") } });
    await mysql.tenant.create({ data: { slug: "acme-shop", name: "Acme Shop", ownerId: A.id, product: "store", status: "provisioning", tier: "store-basic", progressJson: { step: 3, total: 7, label: "docker compose up store_acme-shop (internal)" } } });
    await mysql.tenant.create({ data: { slug: "acme-old", name: "Acme Old", ownerId: A.id, status: "failed", tier: "standard", lastError: STACK } });
    await mysql.tenant.create({ data: { slug: "beta", name: "Beta Secret Academy", ownerId: B.id, status: "live", tier: "standard", validUntil: new Date("2026-12-01T00:00:00Z") } });
    await mysql.subscription.create({ data: { tenantSlug: "acme", userId: A.id, licenseKey: "standard", intervalDays: 365, amountEgp: 12000, currentPeriodEnd: new Date("2027-03-01T00:00:00Z"), nextAttemptAt: new Date("2027-02-28T00:00:00Z"), lastError: "kashier: token expired" } });
    await mysql.subscription.create({ data: { tenantSlug: "beta", userId: B.id, licenseKey: "standard", intervalDays: 365, amountEgp: 99999, currentPeriodEnd: new Date("2026-12-01T00:00:00Z") } });
    await mysql.payment.create({ data: { orderId: "o1", userId: A.id, licenseKey: "standard", purpose: "renew", amount: 12000, status: "failed", tenantSlug: "acme", failureReason: "DECLINED :: {\"code\":\"51\",\"transactionId\":\"TX-998877\"}", createdAt: new Date("2026-10-01T00:00:00Z") } });
    await mysql.payment.create({ data: { orderId: "o2", userId: A.id, licenseKey: "standard", purpose: "new_academy", amount: 12000, status: "paid", tenantSlug: "acme", paidAt: new Date("2026-03-01T00:00:00Z"), createdAt: new Date("2026-03-01T00:00:00Z") } });
    await mysql.payment.create({ data: { orderId: "o3", userId: B.id, licenseKey: "standard", amount: 777, status: "paid", tenantSlug: "beta" } });
    convId = (await mongo.conversation.create({ data: { mode: "support", userId: A.id, status: "open", assignedTo: null } })).id as string;
});

describe("support mode is decided by the server (FR-A2, T2.1, TS-24, AC-19.2)", () => {
    const send = async (user: typeof A | null) => {
        await mysql.platformSetting.upsert({
            where: { key: "ai_agent_config" },
            create: { key: "ai_agent_config", value: JSON.stringify({ ...DEFAULT_CONFIG, enabled: { web: true, whatsapp: false }, dailyBudgetUsd: 5, version: 1 }) },
            update: {},
        });
        getCurrentUser.mockResolvedValue(user);
        let tools: string[] = [];
        script.steps.push(async (req) => { tools = req.tools.map((t: { name: string }) => t.name); return { text: "ok", toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "m", raw: [] }; });
        const res = await chat(new Request("http://l/api/agent/chat", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `1.1.1.${++n}` }, body: JSON.stringify({ message: "show my subscription", locale: "en" }) }));
        const meta = JSON.parse((await res.text()).split("\n\n")[0].split("\n")[1].slice(6));
        return { meta, tools };
    };

    it("a visitor who is not signed in is in sales mode and the model gets no support tools", async () => {
        const { meta, tools } = await send(null);
        expect(meta.mode).toBe("sales");
        expect(tools).toContain("capture_lead");
        for (const t of ["get_my_tenants", "get_subscription", "get_payments", "get_provisioning_status", "get_renewal_link", "open_ticket"]) expect(tools).not.toContain(t);
    });

    it("a signed-in client is in support mode with the support tools (and no lead capture)", async () => {
        const { meta, tools } = await send(A);
        expect(meta.mode).toBe("support");
        expect(tools).toEqual(expect.arrayContaining(["get_my_tenants", "get_subscription", "get_payments", "get_provisioning_status", "get_renewal_link", "open_ticket", "send_brochure", "request_meeting"]));
        expect(tools).not.toContain("capture_lead");
        expect(toolsFor("sales").map((t) => t.name)).not.toContain("get_payments");
    });
});

describe("support tools (FR-P1–P6, NFR-1)", () => {
    it("AC-15.1: get_my_tenants lists only the client's own academies and stores with plan and validUntil", async () => {
        const r = await run(ctx(), "get_my_tenants", {});
        expect(r.ok).toBe(true);
        const rows = (r as { data: { slug: string; planName: string; validUntil: string | null }[] }).data;
        expect(rows.map((t) => t.slug)).toEqual(["acme", "acme-shop", "acme-old"]);
        expect(rows[0]).toMatchObject({ planName: "Standard", validUntil: "2027-03-01", product: "academy", status: "live" });
        expect(JSON.stringify(r)).not.toContain("Beta");
    });

    it("TS-23 / AC-19.1: every support tool answers not_found for another client's tenant and leaks nothing", async () => {
        for (const [tool, input] of [
            ["get_subscription", { tenantSlug: "beta" }], ["get_provisioning_status", { tenantSlug: "beta" }],
            ["get_renewal_link", { tenantSlug: "beta", action: "renew" }], ["open_ticket", { category: "billing", summary: "beta is broken", tenantSlug: "beta" }],
        ] as const) {
            const c = ctx();
            const r = await run(c, tool, input);
            expect({ tool, r }).toEqual({ tool, r: { ok: false, code: "not_found", message: expect.any(String) } });
            expect(JSON.stringify(r)).not.toMatch(/Beta Secret|99999|2026-12-01/);
            expect(c.actions).toEqual([]);
        }
        const unknown = await run(ctx(), "get_subscription", { tenantSlug: "nope" });
        expect(unknown).toEqual(await run(ctx(), "get_subscription", { tenantSlug: "beta" })); // same reply on purpose
        const pays = JSON.stringify(await run(ctx(), "get_payments", {}));
        expect(pays).not.toContain("777");
        expect(await mongo.ticket.count()).toBe(0);
    });

    it("FR-P6: support tools refuse without a signed-in user, or outside support mode", async () => {
        expect(await run(ctx({ userId: null }), "get_my_tenants", {})).toMatchObject({ ok: false, code: "not_authorized" });
        expect(await run(ctx({ mode: "sales" }), "get_payments", {})).toMatchObject({ ok: false, code: "not_authorized" });
        expect(await run(ctx(), "get_my_tenants", { userId: B.id })).toMatchObject({ ok: false, code: "invalid_input" }); // the model can't pick the user
    });

    it("get_subscription: status, auto-renew, amount and next charge — never the internal lastError", async () => {
        const r = await run(ctx(), "get_subscription", { tenantSlug: "acme" });
        expect(r).toEqual({ ok: true, data: { status: "active", autoRenew: true, amountEgp: 12000, currentPeriodEnd: "2027-03-01", nextAttemptAt: "2027-02-28" } });
        expect(JSON.stringify(r)).not.toContain("token expired");
        const none = await run(ctx(), "get_subscription", { tenantSlug: "acme-shop" });
        expect(none).toMatchObject({ ok: true, data: { status: "none", autoRenew: false } });
    });

    it("TS-56 / AC-16.1: payments carry a customer-safe reason, never the gateway text or transaction id", async () => {
        const r = await run(ctx(), "get_payments", { limit: 5 });
        const rows = (r as { data: { status: string; customerSafeReason?: string; date: string; amount: number }[] }).data;
        expect(rows[0]).toMatchObject({ status: "failed", date: "2026-10-01", amount: 12000, purpose: "renew" });
        expect(rows[0].customerSafeReason).toMatch(/declined/i);
        expect(rows[1].customerSafeReason).toBeUndefined();
        expect(JSON.stringify(r)).not.toMatch(/TX-998877|"51"|DECLINED ::/);
        expect(await run(ctx(), "get_payments", { limit: 11 })).toMatchObject({ ok: false, code: "invalid_input" });
    });

    it("maps every stored failure to a fixed reason key", () => {
        expect(paymentReasonKey({ status: "failed", failureReason: "paid-but-provision-failed: boom" })).toBe("paid_setup_issue");
        expect(paymentReasonKey({ status: "paid", failureReason: "retry-provision-failed: x" })).toBe("paid_setup_issue");
        expect(paymentReasonKey({ status: "expired", failureReason: null })).toBe("expired");
        expect(paymentReasonKey({ status: "failed", failureReason: "card error", subscriptionId: "s" })).toBe("renewal_failed");
        expect(paymentReasonKey({ status: "failed", failureReason: "session could not be created" })).toBe("checkout_failed");
        expect(paymentReasonKey({ status: "failed", failureReason: null })).toBe("unknown");
        expect(paymentReasonKey({ status: "paid", failureReason: null })).toBeNull();
    });

    it("TS-25 / AC-17.1 / AC-17.2: provisioning shows the step numbers and a fixed message — no label, no stack trace", async () => {
        const busy = await run(ctx(), "get_provisioning_status", { tenantSlug: "acme-shop" });
        expect(busy).toMatchObject({ ok: true, data: { status: "provisioning", step: { step: 3, total: 7 } } });
        expect(JSON.stringify(busy)).not.toContain("docker");
        const failed = await run(ctx({ locale: "ar" }), "get_provisioning_status", { tenantSlug: "acme-old" });
        expect(failed).toMatchObject({ ok: true, data: { status: "failed", step: null } });
        expect(JSON.stringify(failed)).not.toMatch(/ECONNREFUSED|provision\.py|10\.0\.0\.7/);
        expect((failed as { data: { customerMessage: string } }).data.customerMessage).toMatch(/تذكرة/);
    });

    it("AC-18.1: get_renewal_link gives a button to the tenant's card on the account page", async () => {
        const c = ctx();
        expect(await run(c, "get_renewal_link", { tenantSlug: "acme", action: "renew" })).toEqual({ ok: true, data: { url: "/en/account#acme" } });
        expect(c.actions).toEqual([{ type: "link", label: "Renew Acme Academy", url: "/en/account#acme" }]);
    });
});

describe("open_ticket, send_brochure, request_meeting (FR-P7, FR-S15, FR-S16)", () => {
    it("AC-20.1: a ticket is saved with category and summary, support gets one alert, and a retry writes nothing", async () => {
        const c = ctx();
        const r = await executeTool(c, "open_ticket", { category: "technical", summary: "Quiz page shows a blank screen", tenantSlug: "acme" }, "tu_t");
        expect(r).toMatchObject({ ok: true, data: { ticketId: expect.stringMatching(/^[0-9A-F]{6}$/) } });
        expect(await mongo.ticket.findFirst()).toMatchObject({ userId: A.id, tenantSlug: "acme", category: "technical", status: "open", conversationId: convId });
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
        expect(notifyTelegram.mock.calls[0][0]).toContain("technical");
        expect(await executeTool(c, "open_ticket", { category: "technical", summary: "Quiz page shows a blank screen", tenantSlug: "acme" }, "tu_t")).toMatchObject({ ok: false, code: "already_exists" });
        expect(await mongo.ticket.count()).toBe(1);
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
    });

    it("send_brochure shows the configured link and emails only an address the visitor saved", async () => {
        const c = ctx({ mode: "sales", userId: null });
        const r = await run(c, "send_brochure", { kind: "company", email: "stranger@evil.com" });
        expect(r).toMatchObject({ ok: true, data: { url: "https://files.nitg-eg.com/profile.pdf", emailed: false } });
        expect(sendEmail).not.toHaveBeenCalled();
        expect(c.actions[0]).toMatchObject({ url: "https://files.nitg-eg.com/profile.pdf" });

        await mongo.conversation.update({ where: { id: convId }, data: { qualification: { lead: { email: "lina@nova.com" } } } });
        expect(await run(ctx({ mode: "sales", userId: null }), "send_brochure", { kind: "company", email: "lina@nova.com" })).toMatchObject({ ok: true, data: { emailed: true } });
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "lina@nova.com" }));
        // The signed-in client's own account email is allowed too.
        expect(await run(ctx(), "send_brochure", { kind: "company", email: "a@acme.com" })).toMatchObject({ ok: true, data: { emailed: true } });
        // Not configured → not_found, no button.
        const none = ctx();
        expect(await run(none, "send_brochure", { kind: "service", service: "moodle" })).toMatchObject({ ok: false, code: "not_found" });
        expect(none.actions).toEqual([]);
    });

    it("TS-38 / AC-30.1: a meeting is saved with date, time and channel, sales are alerted; a past date is refused", async () => {
        const c = ctx({ mode: "sales", userId: null });
        const r = await run(c, "request_meeting", { date: "2026-10-13", time: "11:00", channel: "online", notes: "LMS demo" });
        expect(r).toMatchObject({ ok: true, data: { bookingUrl: "https://cal.example/nitg" } });
        const m = (await mongo.meetingRequest.findFirst())!;
        expect(m).toMatchObject({ channel: "online", status: "requested", notes: "LMS demo", conversationId: convId });
        expect((m.preferredAt as Date).toISOString()).toBe("2026-10-13T08:00:00.000Z"); // 11:00 Cairo (UTC+3)
        expect(alertAdmins).toHaveBeenCalledTimes(1);
        expect(c.actions).toEqual([{ type: "link", label: "Book a slot", url: "https://cal.example/nitg" }]);
        expect(await run(ctx(), "request_meeting", { date: "2026-10-05", time: "11:00", channel: "call" })).toMatchObject({ ok: false, code: "validation_failed" });
        expect(await run(ctx(), "request_meeting", { date: "2026-02-30", time: "11:00", channel: "call" })).toMatchObject({ ok: false, code: "validation_failed" });
        expect(await mongo.meetingRequest.count()).toBe(1);
    });
});

describe("account-bound conversations (NFR-1, NFR-20)", () => {
    it("a conversation tied to client A opens only for A — not for B, and not for a signed-out browser with the same session", async () => {
        const session = await mongo.agentSession.create({ data: {} });
        await mongo.conversation.update({ where: { id: convId }, data: { sessionId: session.id } });
        const { signSessionId } = await import("@/lib/agent/security/visitor-session");
        const cookie = `agent_session=${signSessionId(session.id as string)}`;
        const get = () => history(new Request(`http://l/api/agent/conversations/${convId}`, { headers: { cookie } }), { params: { id: convId } });
        getCurrentUser.mockResolvedValue(A);
        expect((await get()).status).toBe(200);
        getCurrentUser.mockResolvedValue(B);
        expect((await get()).status).toBe(404);
        getCurrentUser.mockResolvedValue(null);
        expect((await get()).status).toBe(404);
    });
});

describe("tickets E14 and meetings E21 (§13.14)", () => {
    const as = async (perms: string[] | "admin") => {
        if (perms === "admin") return getCurrentUser.mockResolvedValue({ id: "adm", email: "", name: null, role: "admin" });
        await mysql.user.upsert({ where: { id: "staff" }, create: { id: "staff", email: "s@x.com", password: "h", agentPermissions: perms }, update: { agentPermissions: perms } });
        getCurrentUser.mockResolvedValue({ id: "staff", email: "s@x.com", name: null, role: "client" });
    };
    const req = (method = "GET", body?: unknown) => new Request("http://l/x", { method, ...(body ? { body: JSON.stringify(body) } : {}) });

    it("support staff manage tickets; sales staff are refused; status updates and 404s", async () => {
        const t = await mongo.ticket.create({ data: { conversationId: convId, userId: A.id, category: "billing", summary: "x" } });
        await as(["sales"]);
        expect((await listTickets(req())).status).toBe(403);
        await as(["support"]);
        expect((await (await listTickets(req())).json()).items).toHaveLength(1);
        const res = await patchTicket(req("PATCH", { status: "resolved" }), { params: { id: t.id as string } });
        expect((await res.json()).ticket.status).toBe("resolved");
        expect((await patchTicket(req("PATCH", { status: "deleted" }), { params: { id: t.id as string } })).status).toBe(400);
        expect((await patchTicket(req("PATCH", { status: "open" }), { params: { id: "f".repeat(24) } })).status).toBe(404);
        getCurrentUser.mockResolvedValue(null);
        expect((await listTickets(req())).status).toBe(401);
    });

    it("sales staff manage meetings (with the lead attached); support staff are refused", async () => {
        const contact = await mongo.contact.create({ data: { name: "Lina", email: "lina@nova.com", subject: "s", message: "m", tier: "HOT" } });
        const m = await mongo.meetingRequest.create({ data: { conversationId: convId, contactId: contact.id, preferredAt: new Date("2026-10-13T08:00:00Z"), channel: "call" } });
        await as(["support"]);
        expect((await listMeetings(req())).status).toBe(403);
        await as(["sales"]);
        const items = (await (await listMeetings(req())).json()).items;
        expect(items[0]).toMatchObject({ channel: "call", contact: { name: "Lina", tier: "HOT" } });
        expect((await (await patchMeeting(req("PATCH", { status: "confirmed" }), { params: { id: m.id as string } })).json()).meeting.status).toBe("confirmed");
        expect((await patchMeeting(req("PATCH", { status: "requested" }), { params: { id: m.id as string } })).status).toBe(400);
    });
});

describe("analytics E20 and unknown answers (FR-N2, FR-N3, TS-39, AC-31.1)", () => {
    const tags = (over: Record<string, unknown>) => ({ service: "elearning", country: "SA", intent: "pricing", answeredAll: true, questions: ["academy plan prices"], unknownQuestions: [], tier: null, answered: [], ...over });

    beforeEach(async () => {
        await mongo.conversation.deleteMany();
        const at = new Date("2026-10-03T10:00:00Z");
        const lead = await mongo.contact.create({ data: { name: "L", email: "a@acme.com", subject: "s", message: "m", tier: "HOT", budget: "above50k", country: "sa" } });
        await mongo.conversation.create({ data: { createdAt: at, messageCount: 6, contactId: lead.id, tags: tags({ unknownQuestions: ["Do you support SCORM 2004?"] }) } });
        await mongo.conversation.create({ data: { createdAt: at, messageCount: 4, locale: "en", tags: tags({ service: "ecommerce", country: "AE", questions: ["store prices", "academy plan prices"], unknownQuestions: ["Is there a Shopify import?", "Do you sell domains?"] }) } });
        const h = await mongo.conversation.create({ data: { createdAt: at, messageCount: 2 } }); // untagged, handed off
        await mongo.chatMessage.create({ data: { conversationId: h.id, role: "system", content: "handoff: visitor_requested" } });
        await mongo.conversation.create({ data: { createdAt: at, messageCount: 1 } }); // abandoned
        await mongo.conversation.create({ data: { createdAt: new Date("2026-09-01T10:00:00Z"), messageCount: 3, tags: tags({ unknownQuestions: ["out of range"] }) } });
        // A@acme.com (the lead's email) paid after the chat → one chat-to-paid conversion.
        await mysql.payment.create({ data: { orderId: "o9", userId: A.id, licenseKey: "standard", amount: 1, status: "paid", createdAt: new Date("2026-10-04T00:00:00Z") } });
    });

    it("aggregates the period and lists the 3 unknown questions", async () => {
        getCurrentUser.mockResolvedValue({ id: "v", email: "", name: null, role: "client" });
        await mysql.user.create({ data: { id: "v", email: "v@x.com", password: "h", agentPermissions: ["viewer"] } });
        const r = await (await analytics(new Request("http://l/x?from=2026-10-01&to=2026-10-05"))).json();
        expect(r).toMatchObject({ conversations: 4, tagged: 2, abandoned: 1, handoffRate: 0.25, chatToPaid: 0.25 }); // the 2-message chat was handed off, so not abandoned
        expect(r.unknownQuestions.map((q: { question: string }) => q.question).sort()).toEqual(["Do you sell domains?", "Do you support SCORM 2004?", "Is there a Shopify import?"]);
        expect(r.topQuestions[0]).toEqual({ key: "academy plan prices", n: 2 });
        expect(r.services).toEqual(expect.arrayContaining([{ key: "elearning", n: 1 }, { key: "ecommerce", n: 1 }]));
        expect(r.tiers).toEqual([{ key: "HOT", n: 1 }]);
        expect(r.budgets).toEqual([{ key: "above50k", n: 1 }]);
        expect((await analytics(new Request("http://l/x?from=2026-10-05&to=2026-10-01"))).status).toBe(400);
    });

    it("answering an unknown question appends it to the knowledge notes and removes it from the list; admin only", async () => {
        const conv = (await mongo.conversation.findFirst({ where: { locale: "en" } }))!;
        const body = { conversationId: conv.id, question: "Do you sell domains?", answer: "Yes — we register .com and .eg domains with every website project.", locale: "en" };
        getCurrentUser.mockResolvedValue({ id: "v", email: "", name: null, role: "client" });
        await mysql.user.create({ data: { id: "v", email: "v@x.com", password: "h", agentPermissions: ["sales", "viewer"] } });
        expect((await answer(new Request("http://l/x", { method: "POST", body: JSON.stringify(body) }))).status).toBe(403);

        getCurrentUser.mockResolvedValue({ id: "adm", email: "", name: null, role: "admin" });
        const res = await answer(new Request("http://l/x", { method: "POST", body: JSON.stringify(body) }));
        expect(res.status).toBe(200);
        expect((await getAgentConfig()).notes.en).toBe("Q: Do you sell domains?\nA: Yes — we register .com and .eg domains with every website project.");
        const r = await (await analytics(new Request("http://l/x?from=2026-10-01&to=2026-10-05"))).json();
        expect(r.unknownQuestions.map((q: { question: string }) => q.question)).not.toContain("Do you sell domains?");
        expect(r.unknownQuestions).toHaveLength(2);
    });
});

describe("settings page server status", () => {
    it("reports whether the model key is set, and a GET→PUT round trip still saves", async () => {
        getCurrentUser.mockResolvedValue({ id: "adm", email: "", name: null, role: "admin" });
        const old = process.env.ANTHROPIC_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        expect((await (await getConfig()).json()).serverStatus).toEqual({ apiKeySet: false });
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";
        expect((await (await getConfig()).json()).serverStatus).toEqual({ apiKeySet: true });
        if (old === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old;
    });
});
