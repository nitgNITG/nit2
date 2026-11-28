import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, resetAll } from "./helpers/memoryPrisma";

const { mongo } = vi.hoisted(() => ({ mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));

import { computeLeadScoreV2, tierFor } from "@/lib/agent/scoring/score";
import { DEFAULT_SCORING, ScoringSchema } from "@/lib/agent/scoring/config";
import { recalculateLeadScore } from "@/lib/agent/scoring/recalc";

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    resetAll(mongo);
});

describe("lead score v2 (FR-L1, FR-L2, FR-L4)", () => {
    it("TS-29: Saudi company, LMS, budget ≥ $10k, apps, urgent → HOT with every factor listed", () => {
        const r = computeLeadScoreV2({
            country: "SA", projectType: "corporate_training", budgetUsd: 10_000, orgType: "company", mobileApps: true, timeline: "1to3months",
        }, DEFAULT_SCORING);
        expect(r.tier).toBe("HOT");
        expect(r.score).toBe(100); // 25+20+35+15+10+10 = 115, capped
        expect(r.breakdown).toEqual([
            { factor: "country_sa", points: 25 },
            { factor: "service_elearning", points: 20 },
            { factor: "budget_10k_plus", points: 35 },
            { factor: "org_company", points: 15 },
            { factor: "mobile_apps", points: 10 },
            { factor: "urgent_within_3_months", points: 10 },
        ]);
    });

    it("weights each factor once: other GCC +20, e-commerce +15, $5k band +25", () => {
        const r = computeLeadScoreV2({ country: "kw", projectType: "ecommerce", budgetUsd: 7_000 }, DEFAULT_SCORING);
        expect(r.score).toBe(60);
        expect(r.tier).toBe("WARM");
        expect(r.breakdown.map((b) => b.factor)).toEqual(["country_gcc_kw", "service_ecommerce", "budget_5k_plus"]);
    });

    it("an empty lead is COLD with an empty breakdown", () => {
        expect(computeLeadScoreV2({}, DEFAULT_SCORING)).toEqual({ score: 0, tier: "COLD", breakdown: [] });
    });

    it("keeps the existing contact-quality points (phone, business email, role)", () => {
        const r = computeLeadScoreV2({ phone: "+201000000000", email: "a@acme.com", role: "owner" }, DEFAULT_SCORING);
        expect(r.score).toBe(55);
        const free = computeLeadScoreV2({ email: "a@gmail.com" }, DEFAULT_SCORING);
        expect(free.score).toBe(0);
    });

    it("TS-30 / AC-29.1: raising HOT to 85 turns an 82 into WARM", () => {
        const cfg = { ...DEFAULT_SCORING, thresholds: { hot: 85, warm: 50 } };
        expect(tierFor(82, DEFAULT_SCORING)).toBe("HOT");
        expect(tierFor(82, cfg)).toBe("WARM");
        expect(tierFor(49, cfg)).toBe("COLD");
    });

    it("rejects thresholds where warm is not below hot", () => {
        expect(ScoringSchema.safeParse({ ...DEFAULT_SCORING, thresholds: { hot: 50, warm: 60 } }).success).toBe(false);
    });
});

describe("recalculateLeadScore (FR-L3, FR-L5, AC-35.1, TS-45)", () => {
    it("a staff budget edit re-scores at once with a new scoredAt, and the stored config version explains the old score", async () => {
        const old = new Date("2026-01-01T00:00:00Z");
        const c = await mongo.contact.create({
            data: {
                name: "Lead", email: "x@acme.com", subject: "s", message: "m", country: "eg",
                requirements: { projectType: "online_courses", budgetMinUsd: 3_000 },
                score: 35, tier: "COLD", scoringConfigVersion: 3, scoredAt: old,
            },
        });
        // Staff changes the budget to $10,000 in the dashboard.
        await mongo.contact.update({ where: { id: c.id }, data: { requirements: { projectType: "online_courses", budgetMinUsd: 10_000 } } });
        const updated = await recalculateLeadScore(c.id as string, DEFAULT_SCORING, 4);

        expect(updated!.score).toBe(70); // business email 15 + eLearning 20 + budget 35
        expect(updated!.tier).toBe("WARM");
        expect(updated!.scoringConfigVersion).toBe(4);
        expect((updated!.scoredAt as Date).getTime()).toBeGreaterThan(old.getTime());
        expect(updated!.scoreBreakdown).toContainEqual({ factor: "budget_10k_plus", points: 35 });
    });

    it("maps legacy contact-form budget bands to the v2 budget factor", async () => {
        const c = await mongo.contact.create({ data: { name: "L", email: "y@gmail.com", subject: "s", message: "m", budget: "20to50k" } });
        const r = await recalculateLeadScore(c.id as string, DEFAULT_SCORING, 1);
        expect(r!.scoreBreakdown).toEqual([{ factor: "budget_10k_plus", points: 35 }]);
    });

    it("returns null for an unknown contact", async () => {
        expect(await recalculateLeadScore("0".repeat(24), DEFAULT_SCORING, 1)).toBeNull();
    });
});
