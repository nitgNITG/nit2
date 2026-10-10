import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, notifyTelegram } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
    notifyTelegram: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins: vi.fn(), supportWhatsapp: async () => "" }));

import { GET as listConvs } from "@/app/api/agent/admin/conversations/route";
import { GET as getConv } from "@/app/api/agent/admin/conversations/[id]/route";
import { POST as takeover } from "@/app/api/agent/admin/conversations/[id]/takeover/route";
import { POST as releaseRoute } from "@/app/api/agent/admin/conversations/[id]/release/route";
import { POST as reply } from "@/app/api/agent/admin/conversations/[id]/messages/route";
import { GET as getConfig, PUT as putConfig } from "@/app/api/agent/admin/config/route";
import { GET as usage } from "@/app/api/agent/admin/usage/route";
import { GET as listRanges } from "@/app/api/agent/admin/price-ranges/route";
import { PUT as putRange } from "@/app/api/agent/admin/price-ranges/[category]/route";
import { GET as listStaff } from "@/app/api/agent/admin/staff/route";
import { PUT as putPerms } from "@/app/api/agent/admin/staff/[userId]/permissions/route";
import { PATCH as patchLead } from "@/app/api/agent/admin/leads/[id]/route";
import { GET as publicConfig } from "@/app/api/agent/config/route";
import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { dashboardPathAllowed, staffLandingPage, agentNav } from "@/lib/agent/admin";
import { executeTool } from "@/lib/agent/tools/registry";

type Role = "admin" | "sales" | "support" | "viewer" | "client" | "out";
const USERS: Record<Exclude<Role, "out">, { id: string; role: string; agentPermissions?: string[] }> = {
    admin: { id: "u-admin", role: "admin" },
    sales: { id: "u-sales", role: "client", agentPermissions: ["sales"] },
    support: { id: "u-support", role: "client", agentPermissions: ["support"] },
    viewer: { id: "u-viewer", role: "client", agentPermissions: ["viewer"] },
    client: { id: "u-client", role: "client" },
};
function as(role: Role) {
    if (role === "out") return getCurrentUser.mockResolvedValue(null);
    const u = USERS[role];
    getCurrentUser.mockResolvedValue({ id: u.id, email: `${role}@x.com`, name: role, role: u.role === "admin" ? "admin" : "client" });
}
const req = (url: string, method = "GET", body?: unknown) =>
    new Request(`http://localhost${url}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}) });

let salesConv: string;
let supportConv: string;

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    for (const [role, u] of Object.entries(USERS)) {
        await mysql.user.create({ data: { id: u.id, email: `${role}@x.com`, password: "h", name: role, role: u.role, ...(u.agentPermissions ? { agentPermissions: u.agentPermissions } : {}) } });
    }
    salesConv = (await mongo.conversation.create({ data: { mode: "sales", status: "open", assignedTo: null, locale: "en" } })).id as string;
    supportConv = (await mongo.conversation.create({ data: { mode: "support", status: "open", assignedTo: null, locale: "ar" } })).id as string;
    await mongo.chatMessage.create({ data: { conversationId: salesConv, role: "visitor", content: "Hi there" } });
});

// Every admin endpoint, called once.
const ENDPOINTS: { name: string; call: () => Promise<Response>; allowed: Role[] }[] = [
    { name: "E6 list", call: () => listConvs(req("/api/agent/admin/conversations")), allowed: ["admin", "sales", "support"] },
    { name: "E7 sales conversation", call: () => getConv(req("/x"), { params: { id: salesConv } }), allowed: ["admin", "sales"] },
    { name: "E7 support conversation", call: () => getConv(req("/x"), { params: { id: supportConv } }), allowed: ["admin", "support"] },
    { name: "E8 takeover sales", call: () => takeover(req("/x", "POST"), { params: { id: salesConv } }), allowed: ["admin", "sales"] },
    { name: "E11 config", call: () => getConfig(), allowed: ["admin"] },
    { name: "E13 usage", call: () => usage(req("/x?from=2026-10-01&to=2026-10-03")), allowed: ["admin", "sales", "viewer"] },
    { name: "E19 list ranges", call: () => listRanges(), allowed: ["admin", "sales"] },
    { name: "E22 staff", call: () => listStaff(req("/x")), allowed: ["admin"] },
];

describe("permissions matrix on every admin endpoint (§13.14, TS-19, TS-46, AC-11.2, AC-11.3)", () => {
    for (const ep of ENDPOINTS) {
        it(`${ep.name}: 401 signed out, 403 when not allowed, 2xx when allowed`, async () => {
            for (const role of ["out", "client", "admin", "sales", "support", "viewer"] as Role[]) {
                as(role);
                const res = await ep.call();
                const want = role === "out" ? 401 : ep.allowed.includes(role) ? 200 : 403;
                expect({ role, status: res.status }).toEqual({ role, status: want });
                // state-changing endpoint: reset between roles
                await mongo.conversation.updateMany({ data: { status: "open", assignedTo: null } });
            }
        });
    }

    it("AC-11.3: sales staff see only sales conversations; asking for support explicitly is 403", async () => {
        as("sales");
        const res = await (await listConvs(req("/api/agent/admin/conversations"))).json();
        expect(res.items.map((i: { id: string }) => i.id)).toEqual([salesConv]);
        expect((await listConvs(req("/api/agent/admin/conversations?mode=support"))).status).toBe(403);
        as("admin");
        expect((await (await listConvs(req("/api/agent/admin/conversations"))).json()).total).toBe(2);
    });

    it("AC-33.1: the dashboard lets Mona (sales) into sales pages but not settings or staff", () => {
        const mona = { user: { id: "m", email: "", name: null, role: "client" as const }, isAdmin: false, permissions: ["sales" as const] };
        expect(dashboardPathAllowed("/dashboard/conversations", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/conversations/abc", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/price-ranges", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/agent-usage", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/agent-settings", mona)).toBe(false);
        expect(dashboardPathAllowed("/dashboard/agent-staff", mona)).toBe(false);
        expect(dashboardPathAllowed("/dashboard/payments", mona)).toBe(false);
        expect(dashboardPathAllowed("/dashboard", mona)).toBe(false);
        expect(dashboardPathAllowed("", mona)).toBe(false); // no path header → fail closed
        expect(staffLandingPage(mona)).toBe("/dashboard/conversations");
        expect(agentNav(mona).map((i) => i.href)).toEqual(["/dashboard/conversations", "/dashboard/price-ranges", "/dashboard/meetings", "/dashboard/follow-ups", "/dashboard/agent-usage", "/dashboard/agent-analytics"]);
        expect(dashboardPathAllowed("/dashboard/follow-ups", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/meetings", mona)).toBe(true);
        expect(dashboardPathAllowed("/dashboard/tickets", mona)).toBe(false); // tickets are support's
        const viewer = { ...mona, permissions: ["viewer" as const] };
        expect(staffLandingPage(viewer)).toBe("/dashboard/agent-usage");
        expect(staffLandingPage({ ...mona, permissions: [] })).toBeNull();
    });

    it("the sidebar groups pages by topic; staff only get the groups their pages are in", async () => {
        const { ADMIN_NAV, groupNav, isActive } = await import("@/lib/dashboard/nav");
        const admin = { user: { id: "a", email: "", name: null, role: "admin" as const }, isAdmin: true, permissions: [] };
        const all = groupNav([...ADMIN_NAV, ...agentNav(admin)]);
        expect(all.map((g) => g.label)).toEqual(["Overview", "Sales & CRM", "Customers & Support", "Billing", "Website Content", "AI Assistant", "System"]);
        expect(all.find((g) => g.key === "sales")!.items.map((i) => i.label)).toEqual(["AI Inbox", "Contacts", "Follow-ups", "Meetings", "Price Ranges"]);
        expect(all.flatMap((g) => g.items).every((i) => i.icon)).toBe(true);

        const mona = { ...admin, user: { ...admin.user, role: "client" as const }, isAdmin: false, permissions: ["sales" as const] };
        expect(groupNav(agentNav(mona)).map((g) => [g.key, g.items.length])).toEqual([["sales", 4], ["ai", 2]]);

        expect(isActive("/en/dashboard/conversations/abc", "en", "/dashboard/conversations")).toBe(true);
        expect(isActive("/en/dashboard/conversations", "en", "/dashboard")).toBe(false);
        expect(isActive("/ar/dashboard", "ar", "/dashboard")).toBe(true);
    });
});

describe("inbox actions (FR-I3, AC-12.x)", () => {
    it("TS-20 / AC-12.4: two staff take over at once — one 200, the other 409, and the winner owns it", async () => {
        await mysql.user.create({ data: { id: "u-sales2", email: "s2@x.com", password: "h", role: "client", agentPermissions: ["sales"] } });
        getCurrentUser.mockResolvedValueOnce({ id: "u-sales", email: "", name: null, role: "client" })
            .mockResolvedValueOnce({ id: "u-sales2", email: "", name: null, role: "client" });
        const [a, b] = await Promise.all([
            takeover(req("/x", "POST"), { params: { id: salesConv } }),
            takeover(req("/x", "POST"), { params: { id: salesConv } }),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        const winner = a.status === 200 ? "u-sales" : "u-sales2";
        expect(await mongo.conversation.findUnique({ where: { id: salesConv } })).toMatchObject({ status: "human", assignedTo: winner });
    });

    it("reply needs a takeover first; the owner's reply is stored as staff; others are refused; hand back reopens it", async () => {
        as("sales");
        const send = (content: string) => reply(req("/x", "POST", { content }), { params: { id: salesConv } });
        expect((await send("hello")).status).toBe(409); // not taken over yet
        expect((await takeover(req("/x", "POST"), { params: { id: salesConv } })).status).toBe(200);
        expect((await send("")).status).toBe(400);
        const r = await send("Hi, Mona from NITG here");
        expect(r.status).toBe(200);
        expect(await mongo.chatMessage.findFirst({ where: { conversationId: salesConv, role: "staff" } })).toMatchObject({ content: "Hi, Mona from NITG here", staffId: "u-sales" });

        await mysql.user.create({ data: { id: "u-other", email: "o@x.com", password: "h", role: "client", agentPermissions: ["sales"] } });
        getCurrentUser.mockResolvedValue({ id: "u-other", email: "", name: null, role: "client" });
        expect((await send("me too")).status).toBe(403);
        expect((await releaseRoute(req("/x", "POST"), { params: { id: salesConv } })).status).toBe(403);

        as("sales");
        const rel = await releaseRoute(req("/x", "POST"), { params: { id: salesConv } });
        expect(await rel.json()).toEqual({ status: "open" });
        expect(await mongo.conversation.findUnique({ where: { id: salesConv } })).toMatchObject({ status: "open", assignedTo: null });
    });

    it("E7 shows tool rows, the lead and the summary; unknown id → 404", async () => {
        const contact = await mongo.contact.create({ data: { name: "Sara", email: "s@acme.com", subject: "s", message: "m", tier: "WARM", score: 60 } });
        await mongo.conversation.update({ where: { id: salesConv }, data: { contactId: contact.id, summary: "Wants an LMS" } });
        await mongo.chatMessage.create({ data: { conversationId: salesConv, role: "tool", toolName: "list_plans", content: '{"input":{"product":"academy"},"ok":true}' } });
        as("sales");
        const body = await (await getConv(req("/x"), { params: { id: salesConv } })).json();
        expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["visitor", "tool"]);
        expect(body.contact).toMatchObject({ name: "Sara", tier: "WARM" });
        expect(body.summary).toBe("Wants an LMS");
        expect(body.conversation).not.toHaveProperty("ipHash");
        expect((await getConv(req("/x"), { params: { id: "f".repeat(24) } })).status).toBe(404);
    });

    it("filters by status and hasLead", async () => {
        await mongo.conversation.update({ where: { id: salesConv }, data: { status: "waiting_human", contactId: "a".repeat(24) } });
        as("admin");
        const get = async (qs: string) => (await (await listConvs(req(`/api/agent/admin/conversations?${qs}`))).json()).items.map((i: { id: string }) => i.id);
        expect(await get("status=waiting_human")).toEqual([salesConv]);
        expect(await get("hasLead=true")).toEqual([salesConv]);
        expect(await get("hasLead=false")).toEqual([supportConv]);
        expect((await listConvs(req("/api/agent/admin/conversations?status=bogus"))).status).toBe(400);
    });
});

describe("settings E11/E12 (FR-C1, FR-C2)", () => {
    it("TS-21 / AC-13.1: a saved greeting reaches the public widget config at once", async () => {
        as("admin");
        const cfg = await (await getConfig()).json();
        const res = await putConfig(req("/x", "PUT", { ...cfg, enabled: { web: true, whatsapp: false }, dailyBudgetUsd: 3, greeting: { ar: "أهلاً من الإعدادات", en: "Hi from settings" } }));
        expect(res.status).toBe(200);
        expect((await res.json()).version).toBe(1);
        const pub = await (await publicConfig(req("/api/agent/config?locale=ar&page=/ar") as never)).json();
        expect(pub).toMatchObject({ enabled: true, greeting: "أهلاً من الإعدادات" });
    });

    it("TS-55 / AC-13.2: a stale save → 409 config_version_conflict and the newer data stays", async () => {
        as("admin");
        const v0 = await (await getConfig()).json();
        expect((await putConfig(req("/x", "PUT", { ...v0, notes: { ar: "A", en: "A" } }))).status).toBe(200);
        const stale = await putConfig(req("/x", "PUT", { ...v0, notes: { ar: "B", en: "B" } }));
        expect(stale.status).toBe(409);
        expect(await stale.json()).toMatchObject({ error: "config_version_conflict" });
        expect((await (await getConfig()).json()).notes.ar).toBe("A");
    });

    it("invalid settings → 400 with the failing paths", async () => {
        as("admin");
        const v0 = await (await getConfig()).json();
        const res = await putConfig(req("/x", "PUT", { ...v0, modelProfiles: { chat: "gpt-9", summary: "fast" } }));
        expect(res.status).toBe(400);
        expect((await res.json()).issues[0].path).toBe("modelProfiles.chat");
    });
});

describe("usage E13 (FR-C3, TS-22, AC-14.1)", () => {
    it("counts per Cairo day over 3 seeded days, with tokens and cost", async () => {
        await mongo.conversation.deleteMany();
        const at = (iso: string) => new Date(iso);
        for (const [iso, rating] of [["2026-10-01T09:00:00Z", 1], ["2026-10-01T21:30:00Z", -1], ["2026-10-03T08:00:00Z", null]] as const) {
            await mongo.conversation.create({ data: { createdAt: at(iso), rating } });
        }
        // 21:30 UTC on the 1st is 00:30 on the 2nd in Cairo (UTC+3).
        await mongo.contact.create({ data: { name: "a", email: "", subject: "s", message: "m", sourcePage: "chat", tier: "HOT", createdAt: at("2026-10-03T10:00:00Z") } });
        await mongo.contact.create({ data: { name: "b", email: "", subject: "s", message: "m", sourcePage: "/contact", createdAt: at("2026-10-03T10:00:00Z") } });
        await mongo.chatMessage.create({ data: { conversationId: "c".repeat(24), role: "system", content: "handoff: visitor_requested", createdAt: at("2026-10-03T11:00:00Z") } });
        await mongo.usageDaily.create({ data: { date: "2026-10-01", inputTokens: 1000, cacheReadTokens: 500, outputTokens: 200, spentUsd: 0.123456 } });

        as("viewer");
        const { days } = await (await usage(req("/x?from=2026-10-01&to=2026-10-03"))).json();
        expect(days).toEqual([
            { date: "2026-10-01", conversations: 1, leads: 0, hotLeads: 0, handoffs: 0, thumbsUp: 1, thumbsDown: 0, tokensIn: 1500, tokensOut: 200, costUsd: 0.1235 },
            { date: "2026-10-02", conversations: 1, leads: 0, hotLeads: 0, handoffs: 0, thumbsUp: 0, thumbsDown: 1, tokensIn: 0, tokensOut: 0, costUsd: 0 },
            { date: "2026-10-03", conversations: 1, leads: 1, hotLeads: 1, handoffs: 1, thumbsUp: 0, thumbsDown: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 },
        ]);
    });

    it("rejects missing dates, reversed ranges and more than 90 days", async () => {
        as("admin");
        expect((await usage(req("/x?from=2026-10-01"))).status).toBe(400);
        expect((await usage(req("/x?from=2026-10-05&to=2026-10-01"))).status).toBe(400);
        expect((await usage(req("/x?from=2026-01-01&to=2026-12-31"))).status).toBe(400);
    });
});

describe("price ranges E19 (FR-S12, TS-35, AC-28.1, TS-55)", () => {
    const body = { labelAr: "منصة مخصصة", labelEn: "Custom LMS", minUsd: 8000, maxUsd: 20000, notesEn: "Depends on scope", active: true };

    it("401 signed out, 403 client; a range saved by sales is listed and quoted by get_price_range", async () => {
        as("out");
        expect((await putRange(req("/x", "PUT", body), { params: { category: "custom_lms" } })).status).toBe(401);
        as("client");
        expect((await putRange(req("/x", "PUT", body), { params: { category: "custom_lms" } })).status).toBe(403);
        as("sales");
        const res = await putRange(req("/x", "PUT", body), { params: { category: "custom_lms" } });
        expect(res.status).toBe(200);
        expect((await res.json()).range).toMatchObject({ category: "custom_lms", minUsd: 8000, version: 1, updatedBy: "u-sales" });
        expect((await (await listRanges()).json()).items).toHaveLength(1);

        const ctx = {
            conversationId: salesConv, turnId: "t", mode: "sales" as const, channel: "web" as const, locale: "en" as const, userId: null, sessionId: null,
            config: DEFAULT_CONFIG, now: new Date(), actions: [], handoff: null, afterTurn: [],
        };
        expect(await executeTool(ctx, "get_price_range", { category: "custom_lms" }, "tu1")).toMatchObject({ ok: true, data: { available: true, currency: "USD", min: 8000, max: 20000 } });
    });

    it("a stale edit → 409 and the stored range is unchanged; max below min → 400", async () => {
        as("admin");
        await putRange(req("/x", "PUT", body), { params: { category: "custom_lms" } });
        expect((await putRange(req("/x", "PUT", { ...body, version: 1, minUsd: 9000 }), { params: { category: "custom_lms" } })).status).toBe(200);
        const stale = await putRange(req("/x", "PUT", { ...body, version: 1, minUsd: 1 }), { params: { category: "custom_lms" } });
        expect(stale.status).toBe(409);
        expect(await mongo.customPriceRange.findUnique({ where: { category: "custom_lms" } })).toMatchObject({ minUsd: 9000, version: 2 });
        expect((await putRange(req("/x", "PUT", { ...body, minUsd: 5000, maxUsd: 100 }), { params: { category: "x_y" } })).status).toBe(400);
        expect((await putRange(req("/x", "PUT", body), { params: { category: "Bad Category" } })).status).toBe(400);
    });

    it("saves an optional EGP range next to USD and validates it", async () => {
        as("sales");
        const res = await putRange(req("/x", "PUT", { ...body, minEgp: 400000, maxEgp: 1000000 }), { params: { category: "custom_lms" } });
        expect((await res.json()).range).toMatchObject({ minUsd: 8000, maxUsd: 20000, minEgp: 400000, maxEgp: 1000000 });
        expect((await putRange(req("/x", "PUT", { ...body, minEgp: 500000, maxEgp: 100 }), { params: { category: "x_a" } })).status).toBe(400);
        expect((await putRange(req("/x", "PUT", { ...body, maxEgp: 100 }), { params: { category: "x_b" } })).status).toBe(400); // "to" without "from"
        // Clearing EGP (empty) goes back to USD only.
        const cleared = await putRange(req("/x", "PUT", { ...body, version: 1, minEgp: null, maxEgp: null }), { params: { category: "custom_lms" } });
        expect((await cleared.json()).range).toMatchObject({ minEgp: null, maxEgp: null, version: 2 });
        // PUT replaces the whole range: a save that leaves the EGP fields out also clears them.
        await putRange(req("/x", "PUT", { ...body, version: 2, minEgp: 300000 }), { params: { category: "custom_lms" } });
        const omitted = await putRange(req("/x", "PUT", { ...body, version: 3 }), { params: { category: "custom_lms" } });
        expect((await omitted.json()).range).toMatchObject({ minEgp: null, maxEgp: null, version: 4 });
    });
});

describe("staff permissions E22 (FR-C4, US-33)", () => {
    it("lists admins and permission holders; grants and revokes; unknown user → 404", async () => {
        as("admin");
        const list = await (await listStaff(req("/x"))).json();
        expect(list.items.map((u: { userId: string }) => u.userId).sort()).toEqual(["u-admin", "u-sales", "u-support", "u-viewer"]);
        expect(list.items.find((u: { userId: string }) => u.userId === "u-admin").permissions).toEqual(["sales", "support", "viewer"]);

        const found = await (await listStaff(req("/x?q=client@"))).json();
        expect(found.items).toEqual([expect.objectContaining({ userId: "u-client", permissions: [] })]);

        const grant = await putPerms(req("/x", "PUT", { permissions: ["support", "sales", "sales"] }), { params: { userId: "u-client" } });
        expect((await grant.json()).user.permissions).toEqual(["sales", "support"]);
        await putPerms(req("/x", "PUT", { permissions: [] }), { params: { userId: "u-sales" } });
        expect((await mysql.user.findUnique({ where: { id: "u-sales" } }))!.agentPermissions).toBeNull();
        expect((await putPerms(req("/x", "PUT", { permissions: ["admin"] }), { params: { userId: "u-client" } })).status).toBe(400);
        expect((await putPerms(req("/x", "PUT", { permissions: [] }), { params: { userId: "nobody" } })).status).toBe(404);
    });
});

describe("lead edits re-score at once (FR-L3, AC-35.1, TS-45)", () => {
    it("sales changes a WARM lead's budget to $10,000: score, tier, breakdown and scoredAt update", async () => {
        const c = await mongo.contact.create({
            data: {
                name: "Lead", email: "x@acme.com", subject: "s", message: "m", country: "kw",
                requirements: { projectType: "online_courses", budgetMinUsd: 1000 }, score: 55, tier: "WARM", scoredAt: new Date("2026-01-01"),
            },
        });
        as("support");
        expect((await patchLead(req("/x", "PATCH", { requirements: { budgetMinUsd: 10000 } }), { params: { id: c.id as string } })).status).toBe(403);
        as("sales");
        const res = await patchLead(req("/x", "PATCH", { requirements: { budgetMinUsd: 10000 } }), { params: { id: c.id as string } });
        const { contact } = await res.json();
        expect(contact).toMatchObject({ score: 90, tier: "HOT", budget: "5to20k", scoreVersion: 2 });
        expect(contact.scoreBreakdown).toContainEqual({ factor: "budget_10k_plus", points: 35 });
        expect(new Date(contact.scoredAt).getTime()).toBeGreaterThan(new Date("2026-01-01").getTime());
        expect((await patchLead(req("/x", "PATCH", { score: 100 }), { params: { id: c.id as string } })).status).toBe(400);
        expect((await patchLead(req("/x", "PATCH", {}), { params: { id: "f".repeat(24) } })).status).toBe(404);
    });
});
