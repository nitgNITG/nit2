import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { verifyWebhook, isPaidStatus } from "@/lib/kashier";
import { provisionAcademy, licenseToDefinition, triggerSuspend } from "@/lib/provisionAcademy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/kashier/webhook
// Kashier calls this on payment events. We verify the HMAC signature, then — only
// on a confirmed-paid event for a pending payment — run the deferred action:
//   new_academy → provision the academy from the stored payload
//   upgrade|renew → move the academy to the paid tier + reset the term
// Idempotent: a payment already marked paid is acknowledged without re-acting.
export async function POST(req: NextRequest) {
    const payload = await req.text();
    const signature =
        req.headers.get("x-kashier-signature") || req.headers.get("X-Kashier-Signature") || "";

    const v = verifyWebhook(payload, signature);
    if (!v.signatureValid) {
        console.warn("[kashier/webhook] invalid signature", { order: v.merchantOrderId, event: v.eventType });
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const orderId = v.merchantOrderId;
    if (!orderId) return NextResponse.json({ status: "ignored" });

    const payment = await prisma.payment.findUnique({ where: { orderId } }).catch(() => null);
    if (!payment) {
        // Not ours (or already pruned) — acknowledge so Kashier stops retrying.
        return NextResponse.json({ status: "unknown-order" });
    }
    if (payment.status === "paid") {
        return NextResponse.json({ status: "already-processed" });
    }

    // A non-success event → record the failure and stop.
    if (!isPaidStatus(v.status)) {
        await prisma.payment.update({
            where: { orderId },
            data: { status: "failed", providerRef: v.transactionId || v.kashierOrderId, failureReason: v.status || v.eventType },
        }).catch(() => {});
        return NextResponse.json({ status: "recorded-failure" });
    }

    // ── Confirmed paid ──────────────────────────────────────────────────────
    const lic = await prisma.license.findFirst({ where: { key: payment.licenseKey } }).catch(() => null);
    const durationDays = lic?.durationDays ?? 0;
    const definition = lic
        ? licenseToDefinition(lic, {
              validUntil: durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000) : null,
          })
        : "";

    // Mark paid first (idempotency guard) — a second webhook now short-circuits.
    await prisma.payment.update({
        where: { orderId },
        data: { status: "paid", paidAt: new Date(), providerRef: v.transactionId || v.kashierOrderId },
    }).catch(() => {});

    const p: any = payment.payloadJson || {};

    try {
        if (payment.purpose === "new_academy") {
            const result = await provisionAcademy({
                slug: String(p.slug),
                name: String(p.name),
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
            });
            if (!result.ok) {
                console.error("[kashier/webhook] provision failed after payment", orderId, result.error);
                await prisma.payment.update({ where: { orderId }, data: { failureReason: `paid-but-provision-failed: ${result.error}` } }).catch(() => {});
            }
        } else {
            // upgrade | renew — move the existing academy to the paid tier + reset term.
            const slug = payment.academySlug || String(p.slug || "");
            if (slug) {
                const now = new Date();
                const validUntil = durationDays > 0 ? new Date(now.getTime() + durationDays * 86_400_000) : null;
                // Was it suspended (e.g. expired past grace)? Resume Moodle if so.
                const prev = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);
                await prisma.academy.update({
                    where: { slug },
                    // Clear expiry reminders so the fresh term re-arms 7/3/1/on-expiry.
                    data: { tier: payment.licenseKey, status: "live", subscribedAt: now, validUntil, expiryRemindersSent: {} },
                }).catch((e) => console.error("[kashier/webhook] academy update failed", slug, e));
                // Push the new licence to the live Moodle (best-effort).
                await triggerApplyLicense(slug, payment.licenseKey, definition);
                if (prev?.status === "suspended") await triggerSuspend(slug, false);
            }
        }
    } catch (e) {
        console.error("[kashier/webhook] post-payment action error", orderId, e);
    }

    return NextResponse.json({ status: "ok" });
}

// Ask server B to (re)apply the licence on an already-live academy.
async function triggerApplyLicense(slug: string, tier: string, definition: string): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const url = new URL(base);
        url.pathname = `/apply-license/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ tier, definition }),
        });
    } catch (e) {
        console.error("[kashier/webhook] apply-license trigger failed", slug, e);
    }
}
