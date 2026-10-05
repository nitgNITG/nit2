// Lead score v2 weights and tier thresholds (FR-L1–L3). Editable by the admin in
// the agent settings; these are the SRS defaults.
import { z } from "zod";

export const ScoringWeightsSchema = z.strictObject({
    countryTop: z.number().int().min(0).max(100), // Saudi Arabia, UAE
    countryGcc: z.number().int().min(0).max(100), // other GCC
    elearning: z.number().int().min(0).max(100),
    ecommerce: z.number().int().min(0).max(100),
    budget5k: z.number().int().min(0).max(100),
    budget10k: z.number().int().min(0).max(100),
    orgCompanyOrGov: z.number().int().min(0).max(100),
    mobileApps: z.number().int().min(0).max(100),
    customDev: z.number().int().min(0).max(100),
    urgent: z.number().int().min(0).max(100),
    phone: z.number().int().min(0).max(100),
    businessEmail: z.number().int().min(0).max(100),
    roleOwner: z.number().int().min(0).max(100),
    roleManager: z.number().int().min(0).max(100),
    roleEmployee: z.number().int().min(0).max(100),
    detailedPain: z.number().int().min(0).max(100),
});
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;

export const ScoringSchema = z
    .strictObject({
        weights: ScoringWeightsSchema,
        thresholds: z.strictObject({
            hot: z.number().int().min(1).max(100),
            warm: z.number().int().min(0).max(99),
        }),
    })
    .refine((s) => s.thresholds.warm < s.thresholds.hot, { message: "warm must be below hot" });
export type ScoringConfig = z.infer<typeof ScoringSchema>;

export const DEFAULT_SCORING: ScoringConfig = {
    weights: {
        countryTop: 25, countryGcc: 20,
        elearning: 20, ecommerce: 15,
        budget5k: 25, budget10k: 35,
        orgCompanyOrGov: 15, mobileApps: 10, customDev: 15, urgent: 10,
        // "existing contact-quality points" — same values as utils/leadScore.ts
        phone: 20, businessEmail: 15, roleOwner: 20, roleManager: 15, roleEmployee: 5, detailedPain: 10,
    },
    thresholds: { hot: 80, warm: 50 },
};
