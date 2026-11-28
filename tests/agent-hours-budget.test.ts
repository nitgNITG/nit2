import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, resetAll } from "./helpers/memoryPrisma";

const { mongo } = vi.hoisted(() => ({ mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));

import { workingHoursStatus, zonedToUtc } from "@/lib/agent/runtime/hours";
import { budgetLeft, claimBudgetAlert, reserve, settle } from "@/lib/agent/runtime/budget";
import { costUsd } from "@/lib/agent/llm/profiles";

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    resetAll(mongo);
});

const WH = { days: [0, 1, 2, 3, 4], from: "10:00", to: "18:00", tz: "Africa/Cairo" };
const cairo = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

describe("working hours (FR-H4, TS-17)", () => {
    it("Friday 22:00 Cairo → closed, next open Sunday 10:00 Cairo", () => {
        const fri22 = zonedToUtc(2026, 10, 9, 22, 0, "Africa/Cairo"); // 9 Oct 2026 is a Friday
        expect(cairo(fri22)).toBe("Fri 22:00");
        const s = workingHoursStatus(WH, fri22);
        expect(s.open).toBe(false);
        expect(cairo(s.nextOpenAt!)).toBe("Sun 10:00");
    });

    it("open on Sunday 11:00, closed at 18:00 sharp, early morning opens the same day", () => {
        expect(workingHoursStatus(WH, zonedToUtc(2026, 10, 11, 11, 0, "Africa/Cairo")).open).toBe(true);
        const six = workingHoursStatus(WH, zonedToUtc(2026, 10, 11, 18, 0, "Africa/Cairo"));
        expect(six.open).toBe(false);
        expect(cairo(six.nextOpenAt!)).toBe("Mon 10:00");
        const early = workingHoursStatus(WH, zonedToUtc(2026, 10, 12, 8, 30, "Africa/Cairo"));
        expect(cairo(early.nextOpenAt!)).toBe("Mon 10:00");
    });

    it("no working days → never open, no next time", () => {
        expect(workingHoursStatus({ ...WH, days: [] }, new Date())).toEqual({ open: false, nextOpenAt: null });
    });
});

describe("cost (§13.17)", () => {
    it("prices input, output and cache tokens per model", () => {
        const c = costUsd("claude-sonnet-5-5", { inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 100_000 });
        expect(c).toBeCloseTo(2 + 1 + 0.2 + 0.25, 6);
    });
});

describe("budget reservation (NFR-8, TS-51)", () => {
    const now = new Date("2026-10-05T12:00:00Z");

    it("10 parallel turns with $0.25 left: reservations stop at the budget; spend ≤ budget + one estimate", async () => {
        await mongo.usageDaily.create({ data: { date: "2026-10-05", spentUsd: 9.75, committedUsd: 9.75 } });
        const results = await Promise.all(Array.from({ length: 10 }, () => reserve(0.0625, 10, now)));
        const won = results.filter(Boolean);
        expect(won).toHaveLength(4); // 9.75 + 4 × 0.0625 = 10.00 (binary-exact values)
        await Promise.all(won.map((r) => settle(r!, 0.07))); // each actually cost a little more
        const day = await mongo.usageDaily.findUnique({ where: { date: "2026-10-05" } });
        expect(day!.reservedUsd).toBeCloseTo(0, 9);
        expect(day!.spentUsd as number).toBeLessThanOrEqual(10 + 0.0625);
        expect(await budgetLeft(10, now)).toBe(false);
    });

    it("a zero budget never reserves", async () => {
        expect(await reserve(0.001, 0, now)).toBeNull();
        expect(await budgetLeft(0, now)).toBe(false);
    });

    it("settle swaps the estimate for the actual cost and records tokens", async () => {
        const r = await reserve(0.5, 10, now);
        await settle(r!, 0.1, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 3, cacheWriteTokens: 4 });
        const day = await mongo.usageDaily.findUnique({ where: { date: "2026-10-05" } });
        expect(day).toMatchObject({ reservedUsd: 0, spentUsd: 0.1, inputTokens: 100, outputTokens: 20, cacheReadTokens: 3, cacheWriteTokens: 4 });
        expect(day!.committedUsd).toBeCloseTo(0.1, 9);
    });

    it("AC-09.3: the budget alert is claimed exactly once per day", async () => {
        const claims = await Promise.all([claimBudgetAlert(now), claimBudgetAlert(now), claimBudgetAlert(now)]);
        expect(claims.filter(Boolean)).toHaveLength(1);
        expect(await claimBudgetAlert(new Date("2026-10-06T12:00:00Z"))).toBe(true);
    });
});
