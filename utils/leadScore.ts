/**
 * Lead scoring & classification
 * Score 0–100  →  stage: lead | mql | sql | opportunity
 */

interface LeadData {
    email: string;
    phone?: string;
    role?: string;
    service?: string;
    budget?: string;
    timeline?: string;
    pain?: string;
    message?: string;
}

const FREE_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'live.com', 'msn.com', 'ymail.com',
]);

export function computeLeadScore(data: LeadData): { score: number; stage: string } {
    let score = 0;

    // ── Identity ──────────────────────────────────────────────
    if (data.phone?.trim()) score += 20;

    const domain = data.email?.split('@')[1]?.toLowerCase();
    if (domain && !FREE_DOMAINS.has(domain)) score += 15;

    // ── Role / Authority ──────────────────────────────────────
    if (data.role === 'owner')    score += 20;
    else if (data.role === 'manager') score += 15;
    else if (data.role === 'employee') score += 5;

    // ── Service interest ──────────────────────────────────────
    if (data.service && data.service !== 'other') score += 10;

    // ── Budget ────────────────────────────────────────────────
    const budgetMap: Record<string, number> = {
        under5k: 5,
        '5to20k': 15,
        '20to50k': 20,
        above50k: 25,
    };
    if (data.budget) score += budgetMap[data.budget] ?? 0;

    // ── Timeline / Urgency ────────────────────────────────────
    const timelineMap: Record<string, number> = {
        immediate:  25,
        '1to3months': 15,
        '3to6months': 5,
        exploring:  0,
    };
    if (data.timeline) score += timelineMap[data.timeline] ?? 0;

    // ── Content depth ─────────────────────────────────────────
    if (data.pain && data.pain.trim().length > 30) score += 10;
    if (data.message && data.message.trim().length > 100) score += 5;

    score = Math.min(score, 100);

    const stage =
        score >= 76 ? 'opportunity' :
        score >= 51 ? 'sql' :
        score >= 26 ? 'mql' :
                      'lead';

    return { score, stage };
}
