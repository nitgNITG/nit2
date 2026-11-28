// Score a Contact from its stored fields and persist score, tier, breakdown and
// versions (FR-L3, FR-L5, §13.11). Called by capture_lead and by any staff edit
// of a scoring field — not only on the next conversation.
import prisma from "@/prisma/client";
import type { ScoringConfig } from "./config";
import { computeLeadScoreV2, SCORE_VERSION, type BreakdownItem, type Tier } from "./score";

type ContactLike = {
    country?: string | null; service?: string | null; budget?: string | null; timeline?: string | null;
    orgType?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null;
    role?: string | null; pain?: string | null; requirements?: unknown;
};

// Legacy contact-form budget bands → a USD floor for the v2 budget factor.
const BAND_FLOOR: Record<string, number> = { under5k: 0, "5to20k": 5_000, "20to50k": 20_000, above50k: 50_000 };

export function signalsFromContact(c: ContactLike) {
    const req = (c.requirements && typeof c.requirements === "object" ? c.requirements : {}) as Record<string, unknown>;
    const reqBudget = typeof req.budgetMinUsd === "number" ? req.budgetMinUsd : typeof req.budgetMaxUsd === "number" ? req.budgetMaxUsd : undefined;
    return {
        country: (req.country as string | undefined) ?? c.country ?? null,
        service: c.service ?? null,
        projectType: (req.projectType as string | undefined) ?? null,
        budgetUsd: reqBudget ?? (c.budget ? BAND_FLOOR[c.budget] : undefined) ?? null,
        orgType: (req.orgType as string | undefined) ?? c.orgType ?? null,
        mobileApps: (req.mobileApps as boolean | undefined) ?? null,
        timeline: (req.timeline as string | undefined) ?? c.timeline ?? null,
        phone: c.phone || c.whatsapp || null,
        email: c.email ?? null,
        role: c.role ?? null,
        pain: c.pain ?? null,
    };
}

export type ScoreFields = {
    score: number; tier: Tier; scoreBreakdown: BreakdownItem[];
    scoreVersion: number; scoringConfigVersion: number; scoredAt: Date;
};

export function scoreFields(c: ContactLike, cfg: ScoringConfig, configVersion: number, now = new Date()): ScoreFields {
    const r = computeLeadScoreV2(signalsFromContact(c), cfg);
    return { score: r.score, tier: r.tier, scoreBreakdown: r.breakdown, scoreVersion: SCORE_VERSION, scoringConfigVersion: configVersion, scoredAt: now };
}

/** Recompute and store the score of one Contact (staff edits, imports). */
export async function recalculateLeadScore(contactId: string, cfg: ScoringConfig, configVersion: number) {
    const c = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!c) return null;
    const f = scoreFields(c, cfg, configVersion);
    return prisma.contact.update({ where: { id: contactId }, data: f });
}
