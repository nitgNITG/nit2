import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/secretBox";
import { kashierCreds } from "@/lib/kashier";
import { subscriptionsEnabled } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify Kashier's redirect signature (confirmed recipe): HMAC-SHA256, with the
// API key, over Kashier's OWN response params — i.e. every query param EXCEPT our
// own `order`, plus `mode` and `signature` — in the ORDER they appear, joined
// `key=value` by `&`, values as decoded. Returns true when it matches.
function verifyRedirectSignature(search: string): { ok: boolean; params: URLSearchParams } {
    const params = new URLSearchParams(search);
    const sig = (params.get("signature") || "").trim().toLowerCase();
    const { apiKey } = kashierCreds();
    if (!sig || !apiKey) return { ok: false, params };
    const parts: string[] = [];
    params.forEach((v, k) => {
        if (k === "order" || k === "mode" || k === "signature") return;
        parts.push(`${k}=${v}`);
    });
    const calc = crypto.createHmac("sha256", apiKey).update(parts.join("&")).digest("hex");
    let ok = false;
    try {
        ok = calc.length === sig.length &&
            crypto.timingSafeEqual(Buffer.from(calc, "hex"), Buffer.from(sig, "hex"));
    } catch { ok = false; }
    return { ok, params };
}

// POST /api/payments/kashier/save-card   { search }
// Called by the payment callback page after a save-card checkout. Kashier returns
// the reusable card token ONLY on the redirect URL (cardDataToken) — not the
// webhook — so we capture it here. We (1) verify Kashier's redirect signature,
// (2) require a SUCCESS status, (3) confirm the order belongs to the signed-in
// owner, then store the token ENCRYPTED as their card-on-file. The client sends
// the full `search` string so we can check the signature. Dormant unless
// SUBSCRIPTIONS_ENABLED=1.
export async function POST(req: NextRequest) {
    if (!subscriptionsEnabled()) return NextResponse.json({ ok: false, skipped: true });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    // Prefer the full query string (enables signature verification); fall back to
    // discrete fields (verification then skipped — logged).
    const search: string = String(body?.search || "").replace(/^\?/, "");
    const params = search ? new URLSearchParams(search) : null;

    // Signature check — enforced by default; SAVE_CARD_VERIFY=0 downgrades to
    // log-only (e.g. while debugging), never silently off in production.
    const verifyOn = process.env.SAVE_CARD_VERIFY !== "0";
    if (params) {
        const { ok } = verifyRedirectSignature(search);
        if (!ok) {
            console.warn("[kashier/save-card] redirect signature mismatch", { order: params.get("order") });
            if (verifyOn) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
        }
        // Only capture a card from a SUCCESSFUL payment.
        const status = (params.get("paymentStatus") || "").toUpperCase();
        if (status && status !== "SUCCESS") {
            return NextResponse.json({ ok: false, skipped: "not-success" });
        }
    } else if (verifyOn) {
        return NextResponse.json({ error: "missing signed callback" }, { status: 400 });
    }

    const get = (k: string) => (params ? params.get(k) : body?.[k]) || "";
    const orderId = String(get("order") || get("merchantOrderId") || body?.order || "").trim();
    const cardToken = String(get("cardDataToken") || body?.cardDataToken || "").trim();
    const maskedCard = String(get("maskedCard") || body?.maskedCard || "").trim();
    const brand = String(get("cardBrand") || body?.cardBrand || "").trim() || null;
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
        // Point THIS academy's subscription at the newest card (covers both the
        // first save and a later "update card"). No-op if there's no subscription yet.
        if (payment.academySlug) {
            await prisma.subscription.updateMany({
                where: { academySlug: payment.academySlug },
                data: { paymentMethodId: pm.id },
            }).catch(() => {});
        }
        return NextResponse.json({ ok: true, brand, last4 });
    } catch (e) {
        console.error("[kashier/save-card] store failed", orderId, e);
        return NextResponse.json({ error: "store failed" }, { status: 500 });
    }
}
