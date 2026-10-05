// list_plans, recommend_plan, start_checkout (FR-S1, FR-S2, FR-S6, A-04).
// Prices are read live from License (MySQL) and ServicePlan (Mongo) — the only
// package-price authority. start_checkout builds a link; it never creates a Payment.
import { z } from "zod";
import mysql from "@/lib/prismaMysql";
import prisma from "@/prisma/client";
import { defineTool, fail, ok } from "../types";

type LicenseRow = Awaited<ReturnType<typeof mysql.license.findMany>>[number];

function features(l: LicenseRow): Record<string, unknown> {
    return l.features && typeof l.features === "object" && !Array.isArray(l.features) ? (l.features as Record<string, unknown>) : {};
}

function planView(l: LicenseRow) {
    return {
        key: l.key,
        name: l.name,
        priceEgp: l.priceEgp,
        priceEgpMonthly: l.priceEgpMonthly,
        price: l.price, // USD, display only
        limits: {
            maxCourses: l.maxCourses, // -1 = unlimited
            maxTeachers: l.maxTeachers,
            storageGb: l.storageGb,
            mobileApp: l.supportedApp,
            videoSource: l.videoSource,
            durationDays: l.durationDays,
        },
        features: features(l),
        contactSales: l.contactSales,
    };
}

async function activePlans(product: "academy" | "store") {
    return mysql.license.findMany({ where: { product, active: true }, orderBy: [{ order: "asc" }, { priceEgp: "asc" }] });
}

export const listPlans = defineTool({
    name: "list_plans",
    description:
        "List the active plans and their exact prices for a product: academy (Moodle eLearning academy), store (online store), or services (custom service packages, USD starting prices). Prices are EGP for academy/store (annual priceEgp, monthly priceEgpMonthly; 0 monthly = no monthly option). Quote numbers exactly as returned.",
    modes: ["sales", "support"],
    writes: false,
    schema: z.strictObject({ product: z.enum(["academy", "store", "services"]) }),
    async run(ctx, { product }) {
        if (product === "services") {
            const rows = await prisma.servicePlan.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
            const en = ctx.locale === "en";
            return ok(rows.map((p) => ({
                key: p.id, service: p.service, name: en ? p.nameEn : p.nameAr,
                price: p.price, currency: p.currency, features: en ? p.featuresEn : p.featuresAr, startingPrice: true,
            })));
        }
        const rows = await activePlans(product);
        ctx.actions.push({ type: "link", label: ctx.locale === "ar" ? "صفحة الأسعار" : "Pricing page", url: `/${ctx.locale}/pricing` });
        return ok(rows.map(planView), [{ sourceId: `license:${product}`, sourceType: "license", title: `${product} plans` }]);
    },
});

const meets = (limit: number, need: number | undefined) => need == null || limit === -1 || limit >= need;

/** Cheapest buyable plan meeting every stated need; the reason names the deciding limit. */
export function pickPlan(
    plans: LicenseRow[],
    need: { courses?: number; teachers?: number; storageGb?: number; needsDrm?: boolean; needsApp?: boolean },
): { key: string | null; reason: string } {
    const buyable = plans.filter((p) => !p.contactSales).sort((a, b) => a.priceEgp - b.priceEgp);
    const failures = (p: LicenseRow): string[] => {
        const f: string[] = [];
        if (!meets(p.maxCourses, need.courses)) f.push(`courses (needs ${need.courses}, allows ${p.maxCourses})`);
        if (!meets(p.maxTeachers, need.teachers)) f.push(`teachers (needs ${need.teachers}, allows ${p.maxTeachers})`);
        if (need.storageGb != null && p.storageGb < need.storageGb) f.push(`storage (needs ${need.storageGb} GB, has ${p.storageGb} GB)`);
        if (need.needsDrm && features(p).drm !== true) f.push("protected video (DRM) not included");
        if (need.needsApp && !p.supportedApp) f.push("mobile app not included");
        return f;
    };
    let lastReason = "";
    for (const p of buyable) {
        const f = failures(p);
        if (f.length === 0) {
            return {
                key: p.key,
                reason: lastReason
                    ? `${p.name} is the lowest plan that meets every need; the cheaper plan fell short on ${lastReason}.`
                    : `${p.name} is the lowest plan and already meets every stated need.`,
            };
        }
        lastReason = f.join(", ");
    }
    return { key: null, reason: "custom" };
}

export const recommendPlan = defineTool({
    name: "recommend_plan",
    description:
        "Recommend the lowest plan that meets the visitor's stated needs. Pass only the needs they actually stated. Returns { key, reason }, or { key: null, reason: 'custom' } when no plan fits — then say a custom plan is needed and offer a person.",
    modes: ["sales"],
    writes: false,
    schema: z.strictObject({
        product: z.enum(["academy", "store"]),
        courses: z.number().int().min(0).max(1_000_000).optional(),
        teachers: z.number().int().min(0).max(1_000_000).optional(),
        storageGb: z.number().int().min(0).max(100_000).optional(),
        needsDrm: z.boolean().optional(),
        needsApp: z.boolean().optional(),
    }),
    async run(_ctx, { product, ...need }) {
        return ok(pickPlan(await activePlans(product), need));
    },
});

export const startCheckout = defineTool({
    name: "start_checkout",
    description:
        "Give the visitor a button to buy a plan on the existing build-product page with the plan pre-selected. It does not take payment. Use the plan key from list_plans.",
    modes: ["sales", "support"],
    writes: false,
    schema: z.strictObject({
        product: z.enum(["academy", "store"]),
        tier: z.string().regex(/^[a-z0-9_-]{1,40}$/),
        cycle: z.enum(["monthly", "annual"]),
    }),
    async run(ctx, { product, tier, cycle }) {
        const plan = await mysql.license.findFirst({ where: { key: tier, product, active: true } });
        if (!plan) return fail("not_found", "No active plan with that key for this product.");
        if (plan.contactSales) return fail("validation_failed", "This plan is sold through the sales team, not online. Offer a person.");
        if (cycle === "monthly" && plan.priceEgpMonthly <= 0) return fail("validation_failed", "This plan has no monthly option; use annual.");
        const qs = new URLSearchParams({ ...(product === "store" ? { product: "store" } : {}), tier, cycle });
        const url = `/${ctx.locale}/build-product?${qs.toString()}`;
        ctx.actions.push({ type: "link", label: ctx.locale === "ar" ? `اشترك في ${plan.name}` : `Get ${plan.name}`, url });
        return ok({ url });
    },
});
