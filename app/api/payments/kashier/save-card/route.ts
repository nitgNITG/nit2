import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/secretBox";
import { subscriptionsEnabled } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/kashier/save-card
// Called by the payment callback page after a save-card checkout. Kashier returns
// the reusable card token ONLY on the redirect URL (cardDataToken) — not in the
// webhook — so we capture it here: verify the order belongs to the signed-in owner,
// then store the token ENCRYPTED as their card-on-file for auto-renew. Dormant
// unless SUBSCRIPTIONS_ENABLED=1.
export async function POST(req: NextRequest) {
    if (!subscriptionsEnabled()) return NextResponse.json({ ok: false, skipped: true });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const orderId = String(body?.order || body?.merchantOrderId || "").trim();
    const cardToken = String(body?.cardDataToken || body?.cardToken || "").trim();
    const maskedCard = String(body?.maskedCard || "").trim();
    const brand = String(body?.cardBrand || "").trim() || null;
    if (!orderId || !cardToken) {
        return NextResponse.json({ error: "missing order or cardDataToken" }, { status: 400 });
    }

    // The order must be THIS user's — ties the token to its real owner (and to the
    // customerReference we send Kashier, which is the user id the token is bound to).
    const payment = await prisma.payment.findUnique({ where: { orderId } }).catch(() => null);
    if (!payment || payment.userId !== user.id) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const tokenEnc = encryptSecret(cardToken);
    if (!tokenEnc) {
        // CREDENTIAL_SECRET missing — refuse to store a token in the clear.
        console.error("[kashier/save-card] CREDENTIAL_SECRET not set; cannot store token");
        return NextResponse.json({ error: "server not configured for card storage" }, { status: 500 });
    }
    const last4 = (maskedCard.match(/(\d{4})\D*$/)?.[1]) || null;

    try {
        // Latest saved card becomes the default; demote the rest. (Simple card-on-file
        // model — one active card per user for auto-renew.)
        await prisma.paymentMethod.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
        const pm = await prisma.paymentMethod.create({
            data: {
                userId: user.id, customerReference: user.id, cardTokenEnc: tokenEnc,
                brand, last4, isDefault: true,
            },
        });
        // If a subscription for this academy already opened (webhook race), attach the
        // card so billing charges this token explicitly.
        if (payment.academySlug) {
            await prisma.subscription.updateMany({
                where: { academySlug: payment.academySlug, paymentMethodId: null },
                data: { paymentMethodId: pm.id },
            }).catch(() => {});
        }
        return NextResponse.json({ ok: true, brand, last4 });
    } catch (e) {
        console.error("[kashier/save-card] store failed", orderId, e);
        return NextResponse.json({ error: "store failed" }, { status: 500 });
    }
}
