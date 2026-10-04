import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";
import { provisionAcademy, licenseToDefinition } from "@/lib/provisionAcademy";
import { computeUpgradable } from "@/lib/licenseDefinition";
import { createStore, sanitizeStoreSettings } from "@/lib/tenants/createStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/[orderId]/retry-provision
// Recover a PAID academy purchase whose provisioning failed (e.g. a bad GITHUB_TOKEN
// at the time of the webhook), WITHOUT charging again. Re-runs provisionAcademy from
// the pending payload stored on the Payment. Admin only. Idempotent: if the academy
// already exists it reports success and touches nothing.
export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const orderId = params.orderId;
    const payment = await prisma.payment.findUnique({ where: { orderId } }).catch(() => null);
    if (!payment) {
        return NextResponse.json({ error: "payment not found" }, { status: 404 });
    }
    if (payment.status !== "paid") {
        return NextResponse.json({ error: `payment is '${payment.status}', not paid — nothing to recover` }, { status: 400 });
    }
    if (payment.purpose !== "new_academy" && payment.purpose !== "new_store") {
        return NextResponse.json({ error: `only new_academy / new_store payments provision a tenant (this is '${payment.purpose}')` }, { status: 400 });
    }

    const p: any = payment.payloadJson || {};
    const slug = String(p.slug || "");
    if (!slug) {
        return NextResponse.json({ error: "payment has no stored slug/payload to provision from" }, { status: 400 });
    }

    // Already provisioned? Idempotent success.
    const existing = await prisma.tenant.findUnique({ where: { slug } }).catch(() => null);
    if (existing) {
        await prisma.payment.update({ where: { orderId }, data: { failureReason: null } }).catch(() => {});
        return NextResponse.json({ ok: true, slug, alreadyProvisioned: true });
    }

    // Recompute the term + definition exactly as the webhook does.
    const lic = await prisma.license.findFirst({ where: { key: payment.licenseKey } }).catch(() => null);
    const durationDays = (typeof p.cycleDays === "number" && p.cycleDays > 0) ? p.cycleDays : (lic?.durationDays ?? 0);
    const rankLics = await prisma.license.findMany({ where: { active: true }, select: { key: true, active: true, order: true, priceEgp: true } }).catch(() => []);
    const definition = lic
        ? licenseToDefinition(lic, {
              validUntil: durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000) : null,
              subscribedAt: new Date(),
              upgradable: computeUpgradable(payment.licenseKey, rankLics),
          })
        : "";

    if (payment.purpose === "new_store") {
        if (!lic) return NextResponse.json({ error: `licence ${payment.licenseKey} not found` }, { status: 400 });
        const rank = await prisma.license.findMany({ where: { active: true, product: "store" }, select: { key: true, active: true, order: true, priceEgp: true } }).catch(() => []);
        const r = await createStore({
            slug, name: String(p.name || slug), nameAr: p.name_ar ?? null, store: sanitizeStoreSettings(p.store),
            lic, rank, durationDays,
            owner: { id: payment.userId, email: String(p.owner_email || ""), name: String(p.owner_name || ""), locale: p.locale === "en" ? "en" : "ar" },
            licenseMode: payment.mode === "test" ? "test" : "live",
            force: true, // a failed first attempt may have left a half-created store behind
        });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        await prisma.payment.update({ where: { orderId }, data: { failureReason: null } }).catch(() => {});
        return NextResponse.json({ ok: true, slug, job: r.job, status: "queued" });
    }

    const result = await provisionAcademy({
        slug,
        name: String(p.name || slug),
        brand: p.brand || {},
        tier: payment.licenseKey,
        durationDays,
        definition,
        owner: {
            id: payment.userId,
            email: String(p.owner_email || ""),
            name: String(p.owner_name || ""),
            locale: p.locale === "en" ? "en" : "ar",
        },
        platformLang: ["ar", "en", "both"].includes(p.platform_lang) ? p.platform_lang : "both",
        licenseMode: payment.mode === "test" ? "test" : "live",
    });

    if (!result.ok) {
        await prisma.payment.update({ where: { orderId }, data: { failureReason: `retry-provision-failed: ${result.error}` } }).catch(() => {});
        // Surface the real cause (e.g. GitHub 401) so the admin can fix the root issue.
        return NextResponse.json({ error: result.error, detail: "provisioning failed again — fix the cause and retry" }, { status: 502 });
    }

    await prisma.payment.update({ where: { orderId }, data: { failureReason: null } }).catch(() => {});
    return NextResponse.json({ ok: true, slug });
}
