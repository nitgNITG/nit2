import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, llm } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
    llm: { stream: vi.fn(), complete: vi.fn(async () => ({ text: "{}", toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "m", raw: [] })), estimateInputTokens: vi.fn(() => 1) },
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram: vi.fn() }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins: vi.fn(), supportWhatsapp: async () => "" }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { executeTool } from "@/lib/agent/tools/registry";
import { takeOverConversation } from "@/lib/agent/inbox";
import { GET as activity } from "@/app/api/agent/admin/leads/[id]/activity/route";
import type { ToolContext } from "@/lib/agent/tools/types";

let convId: string;
let n = 0;
const ctx = (): ToolContext => ({
    conversationId: convId, turnId: "t", mode: "sales", channel: "web", locale: "en", userId: null, sessionId: null,
    config: { ...DEFAULT_CONFIG, dailyBudgetUsd: 5 }, now: new Date("2026-10-06T10:00:00Z"), actions: [], handoff: null, afterTurn: [],
});
const call = (name: string, input: unknown) => executeTool(ctx(), name, input, `tu_${++n}`);
const events = async () => (await mongo.activity.findMany({ orderBy: { createdAt: "asc" } })).map((a) => a.event);
const visitor = { name: "Sara", phone: "+201001234567", email: "sara@acme.com" };
const admin = { id: "adm", email: "a@x", name: "Admin", role: "admin" as const };

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(admin);
    convId = (await mongo.conversation.create({ data: { status: "open", assignedTo: null, mode: "sales" } })).id as string;
});

describe("CRM timeline on the lead (FR-I4, §13.12)", () => {
    it("the first save of a lead records 'AI conversation' once — later saves don't repeat it", async () => {
        await call("capture_lead", visitor);
        await call("capture_lead", { pain: "Need an LMS fast" });
        expect(await events()).toEqual(["AI_CONVERSATION_STARTED"]);
        const a = (await mongo.activity.findFirst())!;
        const lead = (await mongo.contact.findFirst())!;
        expect(a).toMatchObject({ contactId: lead.id, conversationId: convId, channel: "web", createdBy: "AI", type: "chat" });
    });

    it("a handoff and a staff takeover that happened BEFORE the lead existed are backfilled with their original times", async () => {
        const t1 = new Date("2026-10-06T09:00:00Z"), t2 = new Date("2026-10-06T09:05:00Z");
        await mongo.chatMessage.create({ data: { conversationId: convId, role: "system", content: "handoff: visitor_requested", createdAt: t1 } });
        await mongo.chatMessage.create({ data: { conversationId: convId, role: "system", content: "human_takeover", staffId: "staff-7", createdAt: t2 } });
        await call("capture_lead", visitor);
        const rows = await mongo.activity.findMany({ orderBy: { createdAt: "asc" } });
        expect(rows.map((r) => [r.event, r.createdBy])).toEqual([["AI_HANDOFF", "AI"], ["HUMAN_TAKEOVER", "staff-7"], ["AI_CONVERSATION_STARTED", "AI"]]);
        expect(rows[0]).toMatchObject({ summary: "visitor_requested", createdAt: t1 });
    });

    it("a lead becoming HOT records 'qualified' once, with the tier and score at that moment", async () => {
        const hot = { ...visitor, orgType: "company", country: "SA", requirements: { projectType: "corporate_training", mobileApps: true, timeline: "1to3months", budgetMinUsd: 10000 } };
        await call("capture_lead", hot);
        await call("capture_lead", { pain: "Also need SSO" });
        const q = await mongo.activity.findMany({ where: { event: "AI_LEAD_QUALIFIED" } });
        expect(q).toHaveLength(1);
        expect(q[0]).toMatchObject({ tier: "HOT", score: 100 });
    });

    it("handoffs and takeovers after the lead exists are recorded each time, takeover by the staff member", async () => {
        await call("capture_lead", visitor);
        await call("handoff_to_human", { reason: "custom quote", summary: "wants a quote" });
        await mysql.user.create({ data: { id: "s1", email: "mona@nitg.com", password: "x", name: "Mona", agentPermissions: ["sales"] } });
        await takeOverConversation({ user: { id: "s1", email: "mona@nitg.com", name: "Mona", role: "client" }, isAdmin: false, permissions: ["sales"] }, convId);
        expect(await events()).toEqual(["AI_CONVERSATION_STARTED", "AI_HANDOFF", "HUMAN_TAKEOVER"]);
        expect((await mongo.activity.findFirst({ where: { event: "HUMAN_TAKEOVER" } }))!.createdBy).toBe("s1");
    });

    it("no lead yet → nothing is recorded (the backfill covers it later)", async () => {
        await call("handoff_to_human", { reason: "asked", summary: "x" });
        expect(await mongo.activity.count()).toBe(0);
    });
});

describe("GET /api/agent/admin/leads/[id]/activity", () => {
    const get = (id: string) => activity(new Request("http://l/x"), { params: { id } });

    it("lists the timeline newest first with who did it; admin and sales only", async () => {
        await call("capture_lead", visitor);
        await mysql.user.create({ data: { id: "s1", email: "mona@nitg.com", password: "x", name: "Mona", agentPermissions: ["sales"] } });
        await takeOverConversation({ user: { id: "s1", email: "", name: "Mona", role: "client" }, isAdmin: false, permissions: ["sales"] }, convId);
        const lead = (await mongo.contact.findFirst())!;

        const res = await get(lead.id as string);
        const { items } = await res.json();
        expect(items.map((i: { event: string; createdByName: string }) => [i.event, i.createdByName])).toEqual([["HUMAN_TAKEOVER", "Mona"], ["AI_CONVERSATION_STARTED", "AI assistant"]]);

        await mysql.user.create({ data: { id: "sup", email: "sup@x", password: "x", agentPermissions: ["support"] } });
        getCurrentUser.mockResolvedValue({ id: "sup", email: "sup@x", name: null, role: "client" });
        expect((await get(lead.id as string)).status).toBe(403);
        getCurrentUser.mockResolvedValue(null);
        expect((await get(lead.id as string)).status).toBe(401);
        getCurrentUser.mockResolvedValue(admin);
        expect((await get("f".repeat(24))).status).toBe(404);
    });
});
