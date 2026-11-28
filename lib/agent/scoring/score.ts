// Lead score v2 (FR-L1, FR-L2, FR-L4, §13.11). Deterministic, in code — the model
// never supplies points or a tier. utils/leadScore.ts (v1) keeps serving the
// contact form unchanged.
import type { ScoringConfig } from "./config";

export const SCORE_VERSION = 2;

export type Tier = "HOT" | "WARM" | "COLD";
export type BreakdownItem = { factor: string; points: number };

export type ScoreSignals = {
    country?: string | null; // ISO-2, any case ("SA", "ae")
    service?: string | null; // Contact.service: moodle | ecommerce | custom | other
    projectType?: string | null; // LeadRequirements.projectType
    budgetUsd?: number | null;
    orgType?: string | null;
    mobileApps?: boolean | null;
    timeline?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: string | null;
    pain?: string | null;
};

const TOP = new Set(["SA", "AE"]);
const GCC = new Set(["QA", "KW", "BH", "OM"]);
const ELEARNING = new Set(["online_courses", "corporate_training", "university", "government", "academy"]);
const FREE_DOMAINS = new Set([
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "live.com", "msn.com", "ymail.com",
]);

export function tierFor(score: number, cfg: ScoringConfig): Tier {
    if (score >= cfg.thresholds.hot) return "HOT";
    if (score >= cfg.thresholds.warm) return "WARM";
    return "COLD";
}

export function computeLeadScoreV2(s: ScoreSignals, cfg: ScoringConfig): {
    score: number; tier: Tier; breakdown: BreakdownItem[];
} {
    const w = cfg.weights;
    const items: BreakdownItem[] = [];
    const add = (factor: string, points: number) => { if (points > 0) items.push({ factor, points }); };

    const country = s.country?.trim().toUpperCase();
    if (country && TOP.has(country)) add(`country_${country.toLowerCase()}`, w.countryTop);
    else if (country && GCC.has(country)) add(`country_gcc_${country.toLowerCase()}`, w.countryGcc);

    const isElearning = (s.projectType && ELEARNING.has(s.projectType)) || s.service === "moodle";
    const isEcommerce = s.projectType === "ecommerce" || s.service === "ecommerce";
    if (isElearning) add("service_elearning", w.elearning);
    else if (isEcommerce) add("service_ecommerce", w.ecommerce);

    if (s.budgetUsd != null) {
        if (s.budgetUsd >= 10_000) add("budget_10k_plus", w.budget10k);
        else if (s.budgetUsd >= 5_000) add("budget_5k_plus", w.budget5k);
    }

    if (s.orgType === "company" || s.orgType === "government") add(`org_${s.orgType}`, w.orgCompanyOrGov);
    if (s.mobileApps) add("mobile_apps", w.mobileApps);
    if (s.projectType === "custom_software" || s.projectType === "mobile_app" || s.service === "custom") add("custom_development", w.customDev);
    if (s.timeline === "immediate" || s.timeline === "1to3months") add("urgent_within_3_months", w.urgent);

    // Contact quality (the same signals as v1).
    if (s.phone?.trim()) add("phone", w.phone);
    const domain = s.email?.split("@")[1]?.toLowerCase();
    if (domain && !FREE_DOMAINS.has(domain)) add("business_email", w.businessEmail);
    if (s.role === "owner") add("role_owner", w.roleOwner);
    else if (s.role === "manager") add("role_manager", w.roleManager);
    else if (s.role === "employee") add("role_employee", w.roleEmployee);
    if (s.pain && s.pain.trim().length > 30) add("detailed_pain", w.detailedPain);

    const raw = items.reduce((n, i) => n + i.points, 0);
    const score = Math.min(100, raw);
    return { score, tier: tierFor(score, cfg), breakdown: items };
}
