import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { costUsd, priceModel } from "@/lib/agent/llm/profiles";
import { reserve, settle } from "@/lib/agent/runtime/budget";
import { GET as breakdown } from "@/app/api/agent/admin/usage/breakdown/route";

const usage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
const admin = { id: "adm", email: "a@x", name: "Admin", role: "admin" as const };
const get = async (q: string) => (await breakdown(new Request(`http://l/x?${q}`))).json();

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    getCurrentUser.mockResolvedValue(admin);
});

describe("pricing by the model id the API returns", () => {
    it("a dated snapshot id is priced as its model, not as Opus", () => {
        expect(priceModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5");
        expect(costUsd("claude-haiku-4-5-20251001", usage)).toBeCloseTo(1);
        expect(costUsd("claude-sonnet-5-5", usage)).toBeCloseTo(2);
    });

    it("an unknown model still errs safe (Opus price)", () => {
        expect(priceModel("claude-new-9")).toBeNull();
        expect(costUsd("claude-new-9", usage)).toBeCloseTo(4);
    });
});

describe("usage events + cost breakdown", () => {
    async function call(conversationId: string | null, model: string, cost: number, at: Date) {
        const r = (await reserve(0.5, 10, at))!;
        await settle(r, cost, { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50, cacheWriteTokens: 0 }, { kind: "chat", model, conversationId });
        const ev = (await mongo.agentUsageEvent.findMany({})).at(-1)!;
        await mongo.agentUsageEvent.update({ where: { id: ev.id }, data: { createdAt: at } });
    }

    it("settle logs one event per call only when usage and meta are given", async () => {
        const r = (await reserve(0.5, 10))!;
        await settle(r, 0); // failed call
        expect(await mongo.agentUsageEvent.count()).toBe(0);
        await settle((await reserve(0.5, 10))!, 0.01, usage, { kind: "brief", model: "claude-haiku-4-5", conversationId: null });
        expect(await mongo.agentUsageEvent.findFirst()).toMatchObject({ kind: "brief", model: "claude-haiku-4-5", costUsd: 0.01, inputTokens: 1_000_000 });
    });

    it("groups cost per model, per UTC day and per visitor (account > guest session > IP)", async () => {
        await mysql.user.create({ data: { id: "u1", email: "client@acme.com", password: "x", name: "Client One" } });
        const lead = await mongo.contact.create({ data: { name: "Sara", email: "sara@x.com" } });
        const c1 = await mongo.conversation.create({ data: { userId: "u1", ipHash: "iphashA", messageCount: 4, lastMessageAt: new Date("2026-10-05T10:00:00Z") } });
        const c2 = await mongo.conversation.create({ data: { userId: "u1", ipHash: "iphashB", messageCount: 2, lastMessageAt: new Date("2026-10-05T12:00:00Z") } });
        const c3 = await mongo.conversation.create({ data: { sessionId: "s".repeat(24), contactId: lead.id, ipHash: "iphashA", messageCount: 6, lastMessageAt: new Date("2026-10-05T11:00:00Z") } });
        // 22:30 UTC on the 4th = 01:30 Cairo on the 5th → Cairo range includes it, UTC day is the 4th.
        await call(c1.id as string, "claude-sonnet-5-5", 0.1, new Date("2026-10-04T22:30:00Z"));
        await call(c2.id as string, "claude-sonnet-5-5", 0.05, new Date("2026-10-05T12:00:00Z"));
        await call(c3.id as string, "claude-haiku-4-5-20251001", 0.02, new Date("2026-10-05T11:00:00Z"));
        await call(c3.id as string, "claude-sonnet-5-5", 0.2, new Date("2026-10-05T11:00:00Z"));

        const b = await get("from=2026-10-05&to=2026-10-05");
        expect(b.totalUsd).toBeCloseTo(0.37);
        expect(b.models.map((m: { model: string; calls: number }) => [m.model, m.calls])).toEqual([["claude-sonnet-5-5", 3], ["claude-haiku-4-5-20251001", 1]]);
        expect(b.utcDays).toEqual([{ date: "2026-10-04", costUsd: 0.1 }, { date: "2026-10-05", costUsd: 0.27 }]);
        expect(b.visitors.map((v: { kind: string; label: string; conversations: number; costUsd: number }) => [v.kind, v.label, v.conversations, v.costUsd])).toEqual([
            ["guest", "Sara", 1, 0.22],
            ["user", "Client One", 2, 0.15],
        ]);
        expect(b.visitors[1]).toMatchObject({ messages: 6, detail: "client@acme.com", latestConversationId: c2.id, tokensIn: 300, tokensOut: 20 });

        const byIp = await get("from=2026-10-05&to=2026-10-05&by=ip");
        expect(byIp.visitors.map((v: { kind: string; label: string; costUsd: number }) => [v.kind, v.label, v.costUsd])).toEqual([
            ["ip", "Client One", 0.32], // iphashA: c1 (signed in) + c3 (guest)
            ["ip", "Client One", 0.05],
        ]);
    });

    it("validates `by` and needs analytics access", async () => {
        expect((await breakdown(new Request("http://l/x?from=2026-10-05&to=2026-10-05&by=x"))).status).toBe(400);
        getCurrentUser.mockResolvedValue(null);
        expect((await breakdown(new Request("http://l/x?from=2026-10-05&to=2026-10-05"))).status).toBe(401);
    });
});
