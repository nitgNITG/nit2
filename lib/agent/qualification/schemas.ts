// LeadRequirements (SRS §13.10) — the structured requirements capture_lead stores
// on a Contact. Validated with Zod; strict, so unknown keys (or a score/tier the
// model tries to slip in) are rejected rather than stored.
import { z } from "zod";

export const PROJECT_TYPES = [
    "online_courses", "corporate_training", "university", "government",
    "academy", "ecommerce", "mobile_app", "custom_software", "other",
] as const;
export const TIMELINES = ["immediate", "1to3months", "3to6months", "exploring"] as const;
export const ORG_TYPES = ["individual", "company", "government", "education"] as const;

export const LeadRequirementsSchema = z.strictObject({
    projectType: z.enum(PROJECT_TYPES).optional(),
    expectedUsers: z.number().int().min(1).max(10_000_000).optional(),
    mobileApps: z.boolean().optional(),
    paymentGateway: z.boolean().optional(),
    coupons: z.boolean().optional(),
    videoProtection: z.boolean().optional(),
    languages: z.array(z.enum(["ar", "en", "other"])).max(3).optional(),
    integrations: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    budgetMinUsd: z.number().int().min(0).max(100_000_000).optional(),
    budgetMaxUsd: z.number().int().min(0).max(100_000_000).optional(),
    timeline: z.enum(TIMELINES).optional(),
    country: z.string().regex(/^[A-Za-z]{2}$/, "ISO 3166-1 alpha-2").transform((s) => s.toUpperCase()).optional(),
    orgType: z.enum(ORG_TYPES).optional(),
});
export type LeadRequirements = z.infer<typeof LeadRequirementsSchema>;
export type RequirementField = keyof LeadRequirements;

export type QualificationService = "elearning" | "ecommerce" | "custom" | "mobile";

/** Which guided-qualification script a project type belongs to. */
export function serviceForProjectType(t: LeadRequirements["projectType"]): QualificationService | null {
    switch (t) {
        case "online_courses": case "corporate_training": case "university":
        case "government": case "academy":
            return "elearning";
        case "ecommerce": return "ecommerce";
        case "mobile_app": return "mobile";
        case "custom_software": case "other": return "custom";
        default: return null;
    }
}

/** The legacy Contact.service value (contact form vocabulary) for a qualification service. */
export function contactServiceFor(s: QualificationService | null): string | undefined {
    if (s === "elearning") return "moodle";
    if (s === "ecommerce") return "ecommerce";
    if (s === "custom" || s === "mobile") return "custom";
    return undefined;
}

/** The legacy Contact.budget band for a USD budget. */
export function budgetBand(usd: number | undefined): string | undefined {
    if (usd == null) return undefined;
    if (usd < 5_000) return "under5k";
    if (usd < 20_000) return "5to20k";
    if (usd < 50_000) return "20to50k";
    return "above50k";
}
