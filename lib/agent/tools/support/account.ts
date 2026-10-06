// Support tools (FR-P1–P6, NFR-1, §13.5): read-only views of the SIGNED-IN
// client's own tenants, subscription, payments and provisioning. The user id
// comes from the session (ctx.userId), never from the model; every query filters
// by it, and a tenant the user doesn't own answers not_found — the same reply as
// a tenant that doesn't exist, so nothing leaks.
import { z } from "zod";
import mysql from "@/lib/prismaMysql";
import { defineTool, fail, ok, type ToolContext } from "../types";
import { paymentReason, provisioningStep, tenantStatusMessage } from "./safe";

const Slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);
const NOT_FOUND = "No academy or store with that name on this account.";

function requireUser(ctx: ToolContext): string | null {
    return ctx.mode === "support" && ctx.userId ? ctx.userId : null;
}

/** The tenant only if this user owns it. */
async function ownedTenant(userId: string, slug: string) {
    return mysql.tenant.findFirst({ where: { slug, ownerId: userId } });
}

export const getMyTenants = defineTool({
    name: "get_my_tenants",
    description: "List the signed-in client's own academies and stores: slug, name, product, status, plan and validUntil (end of the current term; null = never expires).",
    modes: ["support"],
    writes: false,
    schema: z.strictObject({}),
    async run(ctx) {
        const userId = requireUser(ctx);
        if (!userId) return fail("not_authorized", "The visitor must be signed in.");
        const tenants = await mysql.tenant.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, take: 50 });
        const keys = Array.from(new Set(tenants.map((t) => t.tier)));
        const plans = keys.length ? await mysql.license.findMany({ where: { key: { in: keys } }, select: { key: true, name: true } }) : [];
        return ok(tenants.map((t) => ({
            slug: t.slug, name: t.name, product: t.product, status: t.status,
            tier: t.tier, planName: plans.find((p) => p.key === t.tier)?.name ?? t.tier,
            validUntil: t.validUntil?.toISOString().slice(0, 10) ?? null,
        })));
    },
});

export const getSubscription = defineTool({
    name: "get_subscription",
    description: "Subscription of one of the client's own academies/stores: status, autoRenew, amountEgp per cycle, currentPeriodEnd and nextAttemptAt (next automatic charge).",
    modes: ["support"],
    writes: false,
    schema: z.strictObject({ tenantSlug: Slug }),
    async run(ctx, { tenantSlug }) {
        const userId = requireUser(ctx);
        if (!userId) return fail("not_authorized", "The visitor must be signed in.");
        const tenant = await ownedTenant(userId, tenantSlug);
        if (!tenant) return fail("not_found", NOT_FOUND);
        const sub = await mysql.subscription.findFirst({ where: { tenantSlug, userId } });
        if (!sub) return ok({ status: "none", autoRenew: false, validUntil: tenant.validUntil?.toISOString().slice(0, 10) ?? null });
        return ok({
            status: sub.status, autoRenew: sub.autoRenew, amountEgp: sub.amountEgp,
            currentPeriodEnd: sub.currentPeriodEnd.toISOString().slice(0, 10),
            nextAttemptAt: sub.autoRenew && sub.nextAttemptAt ? sub.nextAttemptAt.toISOString().slice(0, 10) : null,
        });
    },
});

export const getPayments = defineTool({
    name: "get_payments",
    description: "The client's own last payments (newest first, up to 10): date, amount, currency, purpose, status, tenantSlug and a customer-safe reason for failed ones.",
    modes: ["support"],
    writes: false,
    schema: z.strictObject({ limit: z.number().int().min(1).max(10).optional() }),
    async run(ctx, { limit }) {
        const userId = requireUser(ctx);
        if (!userId) return fail("not_authorized", "The visitor must be signed in.");
        const rows = await mysql.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit ?? 10 });
        return ok(rows.map((p) => ({
            date: (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
            amount: p.amount, currency: p.currency, purpose: p.purpose, status: p.status,
            tenantSlug: p.tenantSlug ?? null,
            customerSafeReason: paymentReason(p, ctx.locale),
        })));
    },
});

export const getProvisioningStatus = defineTool({
    name: "get_provisioning_status",
    description: "Setup status of one of the client's own academies/stores: status, the current step (step/total when known) and a customer message to relay in plain words.",
    modes: ["support"],
    writes: false,
    schema: z.strictObject({ tenantSlug: Slug }),
    async run(ctx, { tenantSlug }) {
        const userId = requireUser(ctx);
        if (!userId) return fail("not_authorized", "The visitor must be signed in.");
        const t = await ownedTenant(userId, tenantSlug);
        if (!t) return fail("not_found", NOT_FOUND);
        const step = ["queued", "branch_created", "provisioning"].includes(t.status) ? provisioningStep(t.progressJson) : null;
        return ok({ status: t.status, step, customerMessage: tenantStatusMessage(t.status, ctx.locale) });
    },
});

export const getRenewalLink = defineTool({
    name: "get_renewal_link",
    description: "A button to renew or upgrade one of the client's own academies/stores (opens it in their account page, where renew, upgrade and update-card live).",
    modes: ["support"],
    writes: false,
    schema: z.strictObject({ tenantSlug: Slug, action: z.enum(["renew", "upgrade"]) }),
    async run(ctx, { tenantSlug, action }) {
        const userId = requireUser(ctx);
        if (!userId) return fail("not_authorized", "The visitor must be signed in.");
        const t = await ownedTenant(userId, tenantSlug);
        if (!t) return fail("not_found", NOT_FOUND);
        const url = `/${ctx.locale}/account#${encodeURIComponent(t.slug)}`;
        const ar = ctx.locale === "ar";
        ctx.actions.push({
            type: "link", url,
            label: action === "renew" ? (ar ? `تجديد ${t.name}` : `Renew ${t.name}`) : (ar ? `ترقية ${t.name}` : `Upgrade ${t.name}`),
        });
        return ok({ url });
    },
});
