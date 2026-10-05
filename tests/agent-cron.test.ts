import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, llm } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    llm: { stream: vi.fn(), complete: vi.fn(), estimateInputTokens: vi.fn(() => 100) },
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { GET, POST } from "@/app/api/cron/agent-daily/route";
import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { runDailyMaintenance } from "@/lib/agent/maintenance";

const NOW = new Date("2026-10-05T03:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const H = 3600_000, D = 24 * H;
const CFG = { ...DEFAULT_CONFIG, dailyBudgetUsd: 5 };

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-s3cret";
    llm.complete.mockResolvedValue({
        text: '{"summary":"Asked about academy prices.","nextAction":"WAIT_FOR_CLIENT"}', toolCalls: [], stopReason: "end",
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [],
    });
});

const call = (handler: typeof GET, secret?: string) =>
    handler(new Request("http://localhost/api/cron/agent-daily", { headers: secret ? { "x-cron-secret": secret } : {} }) as never);

describe("daily agent cron (E18, TS-27, NFR-12)", () => {
    it("401 without or with a wrong secret, and touches nothing", async () => {
        await mongo.conversation.create({ data: { status: "open", lastMessageAt: ago(3 * D) } });
        expect((await call(GET)).status).toBe(401);
        expect((await call(POST, "nope")).status).toBe(401);
        delete process.env.CRON_SECRET;
        expect((await call(GET, "")).status).toBe(401);
        // An empty CRON_SECRET must not be "matched" by an empty header.
        process.env.CRON_SECRET = "";
        const empty = await GET(new Request("http://localhost/api/cron/agent-daily", { headers: { "x-cron-secret": "" } }) as never);
        expect(empty.status).toBe(401);
        expect((await mongo.conversation.findFirst())!.status).toBe("open");
    });

    it("closes conversations idle 24 h+ in any open state, with a summary; leaves recent and closed ones", async () => {
        const idleOpen = await mongo.conversation.create({ data: { status: "open", messageCount: 4, lastMessageAt: ago(25 * H) } });
        const idleHuman = await mongo.conversation.create({ data: { status: "human", assignedTo: "s1", messageCount: 1, lastMessageAt: ago(2 * D) } });
        const recent = await mongo.conversation.create({ data: { status: "open", messageCount: 3, lastMessageAt: ago(23 * H) } });
        const already = await mongo.conversation.create({ data: { status: "closed", lastMessageAt: ago(5 * D) } });
        await mongo.chatMessage.create({ data: { conversationId: idleOpen.id, role: "visitor", content: "prices?" } });

        const r = await runDailyMaintenance(CFG, NOW);
        expect(r).toMatchObject({ closed: 2, summarized: 1, drafts: 0 });
        const status = async (id: unknown) => (await mongo.conversation.findUnique({ where: { id } }))!;
        expect(await status(idleOpen.id)).toMatchObject({ status: "closed", summary: "Asked about academy prices.", stateVersion: 1 });
        expect((await status(idleHuman.id)).status).toBe("closed");
        expect((await status(recent.id)).status).toBe("open");
        expect((await status(already.id)).stateVersion).toBe(0);
        expect(llm.complete).toHaveBeenCalledTimes(1); // the 1-message conversation is not summarised

        // Re-running is a no-op.
        expect(await runDailyMaintenance(CFG, NOW)).toMatchObject({ closed: 0, summarized: 0 });
    });

    it("applies retention per data type and keeps leads", async () => {
        const old = await mongo.conversation.create({ data: { status: "closed", lastMessageAt: new Date("2025-09-01T00:00:00Z") } });
        const keep = await mongo.conversation.create({ data: { status: "closed", lastMessageAt: new Date("2025-11-01T00:00:00Z") } });
        for (const c of [old, keep]) await mongo.chatMessage.create({ data: { conversationId: c.id, role: "visitor", content: "x" } });
        await mongo.contact.create({ data: { name: "Lead", email: "", subject: "s", message: "m", conversationId: old.id } });
        await mongo.toolAudit.create({ data: { conversationId: old.id, turnId: "t", tool: "x", status: "ok", latencyMs: 1, createdAt: ago(181 * D) } });
        await mongo.toolAudit.create({ data: { conversationId: keep.id, turnId: "t", tool: "x", status: "ok", latencyMs: 1, createdAt: ago(179 * D) } });
        await mongo.idempotencyRecord.create({ data: { key: "a", tool: "x", resultJson: {}, createdAt: ago(8 * D) } });
        await mongo.idempotencyRecord.create({ data: { key: "b", tool: "x", resultJson: {}, createdAt: ago(6 * D) } });
        await mongo.agentSession.create({ data: { lastSeenAt: ago(31 * D) } });
        await mongo.agentSession.create({ data: { lastSeenAt: ago(29 * D) } });
        await mongo.rateLimitBucket.create({ data: { key: "k", windowStart: ago(2 * H), expiresAt: ago(H) } });
        await mongo.usageDaily.create({ data: { date: "2024-09-30" } });
        await mongo.usageDaily.create({ data: { date: "2024-10-06" } });

        const r = await runDailyMaintenance(CFG, NOW);
        expect(r.deletedBy).toEqual({ conversations: 1, messages: 1, toolAudits: 1, idempotency: 1, sessions: 1, rateLimits: 1, usageDays: 1 });
        expect(r.deleted).toBe(7);
        expect(await mongo.conversation.findUnique({ where: { id: old.id } })).toBeNull();
        expect(await mongo.chatMessage.count({ where: { conversationId: keep.id } })).toBe(1);
        expect(await mongo.contact.count()).toBe(1); // CRM data is kept
        expect((await mongo.usageDaily.findMany()).map((u) => u.date)).toEqual(["2024-10-06"]);
    });

    it("the route returns the counts", async () => {
        const res = await call(GET, "cron-s3cret");
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ closed: 0, deleted: 0, drafts: 0 });
    });
});
