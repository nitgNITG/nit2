import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeBrand } from "@/lib/brand";
import { createSession, kashierConfigured } from "@/lib/kashier";
import { subscriptionsEnabled } from "@/lib/subscriptions";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// POST /api/payments/kashier/create
// Begin checkout for a PAID academy licence. Validates exactly like the free
// create path, then instead of provisioning it records a pending Payment holding
// the full create payload and returns a Kashier hosted-checkout URL. Nothing is
// provisioned until the webhook confirms the money (see ../webhook/route.ts).
export async function POST(req: NextRequest) {
    if (!kashierConfigured()) {
        return NextResponse.json({ error: "الدفع غير مهيأ حالياً." }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "لازم تسجّل الدخول الأول." }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const name = (body?.name ?? "").toString().trim();
    const slug = (body?.slug ?? "").toString().trim().toLowerCase();
    const requestedKey = (body?.tier ?? "").toString().trim().toLowerCase();
    const brand = sanitizeBrand(body?.brand);
    const locale = body?.locale === "en" ? "en" : "ar";
    const platformLang = ["ar", "en", "both"].includes(body?.platform_lang) ? body.platform_lang : "both";
    const purpose = ["new_academy", "upgrade", "renew"].includes(body?.purpose) ? body.purpose : "new_academy";
    const cycle = body?.cycle === "monthly" ? "monthly" : "annual"; // billing cycle

    // ── Update card ──────────────────────────────────────────────────────────
    // A small verification charge (default 1 EGP) whose only purpose is to save a
    // NEW card on file — no term change, no subscription. The save-card callback
    // captures the new token and re-points the subscription at it.
    if (body?.purpose === "update_card") {
        if (!subscriptionsEnabled()) return NextResponse.json({ error: "غير متاح حالياً." }, { status: 400 });
        const academy = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);
        if (!academy) return NextResponse.json({ error: "الأكاديمية غير موجودة." }, { status: 404 });
        if (user.role !== "admin" && academy.ownerId !== user.id) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        const upAmount = Math.max(1, Number(process.env.CARD_UPDATE_AMOUNT_EGP ?? 1) || 1);
        const orderId = "acad_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
        let base: string;
        try {
            let raw = (process.env.APP_BASE_URL || "").trim();
            if (raw && !/^https?:\/\//i.test(raw)) raw = "https://" + raw;
            base = new URL(raw || new URL(req.url).origin).origin;
        } catch { base = new URL(req.url).origin; }
        try {
            await prisma.payment.create({
                data: {
                    orderId, userId: user.id, licenseKey: academy.tier, purpose: "update_card",
                    amount: upAmount, currency: "EGP", status: "pending", academySlug: slug,
                    payloadJson: { updateCard: true, autoRenew: false },
                },
            });
        } catch (e) {
            console.error("[kashier/create] update_card persist failed", e);
            return NextResponse.json({ error: "تعذّر بدء التحديث، حاول تاني." }, { status: 500 });
        }
        const session = await createSession({
            orderId, amount: upAmount, currency: "EGP", displayLang: locale,
            customerReference: user.id, customerEmail: user.email,
            webhookUrl: `${base}/api/payments/kashier/webhook`,
            successUrl: `${base}/${locale}/payment/callback?order=${orderId}`,
            metadata: { purpose: "update_card", slug }, saveCard: true,
        });
        if (!session.ok) {
            await prisma.payment.update({ where: { orderId }, data: { status: "failed", failureReason: session.error?.slice(0, 900) } }).catch(() => {});
            return NextResponse.json({ error: "تعذّر فتح صفحة الدفع، حاول تاني.", detail: session.error }, { status: 502 });
        }
        await prisma.payment.update({ where: { orderId }, data: { sessionId: session.sessionId } }).catch(() => {});
        return NextResponse.json({ ok: true, url: session.sessionUrl, orderId });
    }

    // ── Upgrade (prorated) ────────────────────────────────────────────────────
    // Charge only the PRICE DIFFERENCE for the remaining days, and keep the same
    // end date — the academy switches to the higher tier immediately without
    // losing (or re-buying) time. Falls back to a full charge if there's no time
    // left. Future auto-renewals then bill the new tier's full price.
    if (body?.purpose === "upgrade") {
        const academy = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);
        if (!academy) return NextResponse.json({ error: "الأكاديمية غير موجودة." }, { status: 404 });
        if (user.role !== "admin" && academy.ownerId !== user.id) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }
        const newLic = await prisma.license.findFirst({ where: { key: requestedKey, active: true } });
        if (!newLic) return NextResponse.json({ error: "الباقة غير موجودة." }, { status: 400 });
        const curLic = await prisma.license.findUnique({ where: { key: academy.tier } });
        const sub = await prisma.subscription.findUnique({ where: { academySlug: slug } }).catch(() => null);
        const cycle: "monthly" | "annual" = sub?.intervalDays === 30 ? "monthly" : "annual";
        const termDays = sub?.intervalDays ?? (curLic?.durationDays ?? 365);
        const priceOf = (l: any) => (cycle === "monthly" ? (l?.priceEgpMonthly ?? 0) : (l?.priceEgp ?? 0));
        const curPrice = priceOf(curLic);
        const newPrice = priceOf(newLic);
        if (newPrice <= 0) return NextResponse.json({ error: "الباقة دي مجانية." }, { status: 400 });
        const now = Date.now();
        const daysLeft = academy.validUntil ? Math.max(0, Math.ceil((academy.validUntil.getTime() - now) / 86_400_000)) : 0;

        // Prorate only when there's time left AND it's a genuine upgrade (higher
        // price). Otherwise fall through to the normal full-price paid path.
        if (daysLeft > 0 && termDays > 0 && newPrice > curPrice) {
            const prorated = Math.max(1, Math.round(((newPrice - curPrice) / termDays) * daysLeft));
            const orderId = "acad_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
            let base: string;
            try {
                let raw = (process.env.APP_BASE_URL || "").trim();
                if (raw && !/^https?:\/\//i.test(raw)) raw = "https://" + raw;
                base = new URL(raw || new URL(req.url).origin).origin;
            } catch { base = new URL(req.url).origin; }
            const keepAutoRenew = !!(sub && sub.autoRenew && sub.status !== "canceled");
            try {
                await prisma.payment.create({
                    data: {
                        orderId, userId: user.id, licenseKey: newLic.key, purpose: "upgrade",
                        amount: prorated, currency: "EGP", status: "pending", academySlug: slug,
                        payloadJson: {
                            proratedUpgrade: true, cycle, cycleDays: termDays,
                            keepEnd: academy.validUntil?.toISOString() ?? null,
                            newFullPrice: newPrice, autoRenew: keepAutoRenew,
                        },
                    },
                });
            } catch (e) {
                console.error("[kashier/create] upgrade persist failed", e);
                return NextResponse.json({ error: "تعذّر بدء الترقية، حاول تاني." }, { status: 500 });
            }
            const session = await createSession({
                orderId, amount: prorated, currency: "EGP", displayLang: locale,
                customerReference: user.id, customerEmail: user.email,
                webhookUrl: `${base}/api/payments/kashier/webhook`,
                successUrl: `${base}/${locale}/payment/callback?order=${orderId}`,
                metadata: { purpose: "upgrade", slug, prorated: "1" },
                saveCard: keepAutoRenew,
            });
            if (!session.ok) {
                await prisma.payment.update({ where: { orderId }, data: { status: "failed", failureReason: session.error?.slice(0, 900) } }).catch(() => {});
                return NextResponse.json({ error: "تعذّر فتح صفحة الدفع، حاول تاني.", detail: session.error }, { status: 502 });
            }
            await prisma.payment.update({ where: { orderId }, data: { sessionId: session.sessionId } }).catch(() => {});
            return NextResponse.json({ ok: true, url: session.sessionUrl, orderId, prorated });
        }
        // else: no remaining time / not higher → fall through to full-price flow below.
    }

    // Validate the licence and that it's actually a PAID one.
    const lic = requestedKey
        ? await prisma.license.findFirst({ where: { key: requestedKey, active: true } })
        : null;
    if (!lic) return NextResponse.json({ error: "الباقة غير موجودة." }, { status: 400 });
    // Cycle picks the price + term: monthly = priceEgpMonthly / 30 days, annual =
    // priceEgp / durationDays. A monthly charge requires a monthly price on the tier.
    const MONTHLY_DAYS = 30;
    const amount = cycle === "monthly" ? (lic.priceEgpMonthly ?? 0) : (lic.priceEgp ?? 0);
    const cycleDays = cycle === "monthly" ? MONTHLY_DAYS : (lic.durationDays ?? 0);
    if (amount <= 0) {
        return NextResponse.json(
            { error: cycle === "monthly" ? "لا يوجد اشتراك شهري لهذه الباقة." : "الباقة دي مجانية — أنشئها مباشرة بدون دفع." },
            { status: 400 },
        );
    }

    if (purpose === "new_academy") {
        if (!name) return NextResponse.json({ error: "اسم الأكاديمية مطلوب." }, { status: 400 });
        if (!SLUG_RE.test(slug)) {
            return NextResponse.json({ error: "المعرّف لازم يكون حروف إنجليزية صغيرة وأرقام وشرطات (3 إلى 40 حرف)." }, { status: 400 });
        }
        // Slug must be free before we take money for it.
        const existing = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);
        if (existing) return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });
    }

    const orderId = "acad_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    // Kashier validates merchantRedirect/serverWebhook as absolute URLs, so `base`
    // MUST be a full origin with a scheme. APP_BASE_URL may be missing a scheme or
    // unset (then we fall back to the request origin). Normalise + validate here.
    let base: string;
    try {
        let raw = (process.env.APP_BASE_URL || "").trim();
        if (raw && !/^https?:\/\//i.test(raw)) raw = "https://" + raw; // tolerate "dev.nitg-eg.com"
        base = new URL(raw || new URL(req.url).origin).origin;
    } catch {
        base = new URL(req.url).origin;
    }
    if (!/^https?:\/\//i.test(base)) {
        console.error("[kashier/create] APP_BASE_URL is not a valid absolute URL:", process.env.APP_BASE_URL);
        return NextResponse.json({ error: "إعداد APP_BASE_URL غير صحيح على الخادم." }, { status: 500 });
    }

    // Persist the pending payment WITH the create payload so the webhook can
    // provision exactly what the client configured — after payment is confirmed.
    // Save the card on file when the buyer opted into auto-renew (body.autoRenew),
    // or globally while testing (KASHIER_SAVE_CARD=1). Needed so the returned token
    // is reusable for recurring charges; also records the auto-renew intent so the
    // webhook opens a Subscription once the term's validUntil is known.
    const saveCard = body?.autoRenew === true || process.env.KASHIER_SAVE_CARD === "1";

    try {
        await prisma.payment.create({
            data: {
                orderId, userId: user.id, licenseKey: lic.key, purpose,
                amount, currency: "EGP", status: "pending",
                academySlug: purpose === "new_academy" ? slug : (body?.slug ?? null),
                payloadJson: {
                    name, slug, tier: lic.key, brand, locale, platform_lang: platformLang,
                    // Snapshot the owner so the (session-less) webhook can provision.
                    owner_email: user.email, owner_name: user.name ?? "",
                    autoRenew: saveCard, // recurring intent for the webhook
                    cycle, cycleDays,    // billing cycle → term + renewal interval
                },
            },
        });
    } catch (e) {
        console.error("[kashier/create] could not persist payment", e);
        return NextResponse.json({ error: "تعذّر بدء عملية الدفع، حاول تاني." }, { status: 500 });
    }

    const session = await createSession({
        orderId,
        amount,
        currency: "EGP",
        displayLang: locale,
        customerReference: user.id,
        customerEmail: user.email,
        webhookUrl: `${base}/api/payments/kashier/webhook`,
        successUrl: `${base}/${locale}/payment/callback?order=${orderId}`,
        metadata: { purpose, licenseKey: lic.key, slug },
        saveCard,
    });

    if (!session.ok) {
        const detail = session.error;
        const raw = (session as any).raw;
        await prisma.payment.update({ where: { orderId }, data: { status: "failed", failureReason: `${detail} :: ${JSON.stringify(raw ?? "")}`.slice(0, 900) } }).catch(() => {});
        console.error("[kashier/create] session failed", detail, raw);
        // Surface Kashier's actual message — this is a paid setup phase and the
        // owner/admin needs to see WHY Kashier rejected the session.
        return NextResponse.json({ error: "تعذّر فتح صفحة الدفع، حاول تاني.", detail, kashier: raw }, { status: 502 });
    }

    await prisma.payment.update({ where: { orderId }, data: { sessionId: session.sessionId } }).catch(() => {});
    return NextResponse.json({ ok: true, url: session.sessionUrl, orderId });
}
