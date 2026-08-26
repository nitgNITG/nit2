import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeBrand } from "@/lib/brand";
import { createSession, kashierConfigured } from "@/lib/kashier";
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

    // Validate the licence and that it's actually a PAID one.
    const lic = requestedKey
        ? await prisma.license.findFirst({ where: { key: requestedKey, active: true } })
        : null;
    if (!lic) return NextResponse.json({ error: "الباقة غير موجودة." }, { status: 400 });
    const amount = lic.priceEgp ?? 0;
    if (amount <= 0) {
        // Free tier — this endpoint is only for paid ones.
        return NextResponse.json({ error: "الباقة دي مجانية — أنشئها مباشرة بدون دفع." }, { status: 400 });
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
    const base = (process.env.APP_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");

    // Persist the pending payment WITH the create payload so the webhook can
    // provision exactly what the client configured — after payment is confirmed.
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
    });

    if (!session.ok) {
        await prisma.payment.update({ where: { orderId }, data: { status: "failed", failureReason: session.error } }).catch(() => {});
        console.error("[kashier/create] session failed", session.error);
        return NextResponse.json({ error: "تعذّر فتح صفحة الدفع، حاول تاني." }, { status: 502 });
    }

    await prisma.payment.update({ where: { orderId }, data: { sessionId: session.sessionId } }).catch(() => {});
    return NextResponse.json({ ok: true, url: session.sessionUrl, orderId });
}
