import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { verifyWebhook, isPaidStatus } from "@/lib/kashier";
import { provisionAcademy, licenseToDefinition, triggerSuspend, triggerExpiryReminder } from "@/lib/provisionAcademy";
import { computeUpgradable } from "@/lib/licenseDefinition";
import { notifyTelegram } from "@/lib/telegram";
import { openSubscription } from "@/lib/billing";

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

    // Token-capture discovery: when KASHIER_DEBUG_WEBHOOK=1, log the shape of the
    // webhook payload so we can see WHICH field carries the saved-card token
    // (cardToken / cardDataToken / …) after a test payment. Values are refs, not
    // card data. Turn off once the field is known.
    if (process.env.KASHIER_DEBUG_WEBHOOK === "1") {
        const d: any = v.raw?.data || {};
        console.log("[kashier/webhook][debug] event", v.eventType, "data keys:", Object.keys(d));
        const tokenish = Object.entries(d).filter(([k]) => /token|card|store/i.test(k));
        if (tokenish.length) console.log("[kashier/webhook][debug] token-ish:", JSON.stringify(Object.fromEntries(tokenish)));
        if (d.card) console.log("[kashier/webhook][debug] data.card:", JSON.stringify(d.card));
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

    // Auto-renew charges (created by the billing engine, subscriptionId set) are
    // fully handled there — term extension, subscription update, receipt + notify.
    // The webhook must NOT re-process them: on a race it would double-extend the
    // term and send a duplicate email. Just acknowledge (mark paid so Kashier
    // stops retrying) and stop.
    if (payment.subscriptionId) {
        if (isPaidStatus(v.status)) {
            await prisma.payment.update({
                where: { orderId },
                data: { status: "paid", paidAt: payment.paidAt ?? new Date(), providerRef: v.transactionId || v.kashierOrderId },
            }).catch(() => {});
        }
        return NextResponse.json({ status: "handled-by-billing" });
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
    // Term comes from the billing cycle the buyer chose (payloadJson.cycleDays):
    // monthly = 30d, annual = the licence's durationDays. Falls back to annual.
    const pj: any = payment.payloadJson || {};
    const durationDays = (typeof pj.cycleDays === "number" && pj.cycleDays > 0)
        ? pj.cycleDays
        : (lic?.durationDays ?? 0);
    const rankLics = await prisma.license.findMany({ where: { active: true }, select: { key: true, active: true, order: true, priceEgp: true } }).catch(() => []);
    const definition = lic
        ? licenseToDefinition(lic, {
              validUntil: durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000) : null,
              // Renew/upgrade both start a fresh term now → mirror subscribedAt into
              // the academy (matches Academy.subscribedAt set below).
              subscribedAt: durationDays > 0 ? new Date() : null,
              upgradable: computeUpgradable(payment.licenseKey, rankLics),
          })
        : "";

    // Mark paid first (idempotency guard) — a second webhook now short-circuits.
    await prisma.payment.update({
        where: { orderId },
        data: { status: "paid", paidAt: new Date(), providerRef: v.transactionId || v.kashierOrderId },
    }).catch(() => {});

    const p: any = pj;

    try {
        if (payment.purpose === "update_card") {
            // Card-update verification charge — the new token was captured by the
            // save-card callback; nothing to provision or extend here.
            await notifyTelegram(`💳 Card updated for ${payment.academySlug || p.slug || "academy"}`);
        } else if (payment.purpose === "new_academy") {
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
                await notifyTelegram(`❌ PAID but provision FAILED — ${p.slug} (order ${orderId}): ${result.error}`);
            } else if (p.autoRenew && durationDays > 0) {
                // Buyer opted into auto-renew → open the recurring subscription. The
                // saved-card token is captured separately by the callback (save-card);
                // openSubscription links it if present, and billing falls back to the
                // user's default card otherwise. No-op unless SUBSCRIPTIONS_ENABLED=1.
                await openSubscription({
                    academySlug: String(p.slug), userId: payment.userId, licenseKey: payment.licenseKey,
                    intervalDays: durationDays, amountEgp: payment.amount, currency: payment.currency,
                    currentPeriodEnd: new Date(Date.now() + durationDays * 86_400_000),
                });
            }
        } else {
            // upgrade | renew — move the existing academy to the paid tier + extend term.
            const slug = payment.academySlug || String(p.slug || "");
            if (slug) {
                const now = new Date();
                // Was it suspended (e.g. expired past grace)? Resume Moodle if so.
                const prev = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);

                // A PRORATED upgrade keeps the SAME end date (they paid only the
                // difference for the remaining days); future renewals bill the new
                // tier's full price. Otherwise (renew, or a full upgrade with no time
                // left) STACK on the remaining term — never lose paid time.
                const prorated = payment.purpose === "upgrade" && p.proratedUpgrade && p.keepEnd;
                const validUntil = prorated
                    ? new Date(p.keepEnd)
                    : (durationDays > 0
                        ? new Date((prev?.validUntil && prev.validUntil.getTime() > now.getTime() ? prev.validUntil : now).getTime() + durationDays * 86_400_000)
                        : null);
                // Recurring amount + interval for the subscription: a prorated upgrade
                // sets the FULL new-tier price (not the prorated one-off charge).
                const subAmount = prorated ? (Number(p.newFullPrice) || payment.amount) : payment.amount;
                const subInterval = prorated ? (Number(p.cycleDays) || durationDays) : durationDays;

                await prisma.academy.update({
                    where: { slug },
                    // Clear expiry reminders so the term re-arms 7/3/1/on-expiry.
                    data: { tier: payment.licenseKey, status: "live", subscribedAt: now, validUntil, expiryRemindersSent: {} },
                }).catch((e) => console.error("[kashier/webhook] academy update failed", slug, e));
                // Push the new licence to the live Moodle (best-effort).
                await triggerApplyLicense(slug, payment.licenseKey, definition);
                if (prev?.status === "suspended") await triggerSuspend(slug, false);
                if (p.autoRenew && subInterval > 0 && validUntil) {
                    await openSubscription({
                        academySlug: slug, userId: payment.userId, licenseKey: payment.licenseKey,
                        intervalDays: subInterval, amountEgp: subAmount, currency: payment.currency,
                        currentPeriodEnd: validUntil,
                    });
                }
                // Email a receipt for the manual renew/upgrade (auto-renew charges get
                // theirs from the billing cron; this covers the customer-present path).
                if (validUntil) {
                    const pm = await prisma.paymentMethod.findFirst({ where: { userId: payment.userId, isDefault: true } }).catch(() => null);
                    const ymd = `${validUntil.getUTCFullYear()}-${String(validUntil.getUTCMonth() + 1).padStart(2, "0")}-${String(validUntil.getUTCDate()).padStart(2, "0")}`;
                    const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / 86_400_000);
                    await triggerExpiryReminder(slug, daysLeft, "", {
                        sendEmail: true, mode: "receipt", amountEgp: payment.amount, cardLast4: pm?.last4 ?? "", expiryDate: ymd,
                    });
                }
                await notifyTelegram(
                    `💳 Academy ${slug} ${payment.purpose === "renew" ? "renewed" : "upgraded"} → ` +
                    `${payment.licenseKey} (paid, until ${validUntil ? validUntil.toISOString().slice(0, 10) : "—"})`,
                );
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
