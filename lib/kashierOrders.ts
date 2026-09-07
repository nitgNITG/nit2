// Kashier DIRECT order API (v3/orders) — "pay with token" for background,
// merchant-initiated recurring charges. Separate from lib/kashier.ts, which drives
// the customer-present HOSTED checkout (v3/payment/sessions).
//
// ⚠ UNVERIFIED SPECIFICS (see docs/subscriptions-auto-renew-plan.md §9): the exact
// v3/orders host, the Kashier-Hash recipe for this endpoint, and whether MIT/
// Recurring runs without OTP for our merchant. This module is only reached when
// SUBSCRIPTIONS_ENABLED=1, so it stays inert until those are confirmed on a live
// test order. Treat the hash/body below as the documented best-guess to validate.
//
// Env (server-only):
//   KASHIER_ORDERS_URL   e.g. https://fep.kashier.io/v3/orders/  (test:
//                        https://test-fep.kashier.io/v3/orders/)
//   + reuses KASHIER_MERCHANT_ID / KASHIER_API_KEY(_B64) / KASHIER_SECRET_KEY(_B64)

import crypto from "crypto";
import { kashierCreds } from "@/lib/kashier";

const ORDERS_URL = (
  process.env.KASHIER_ORDERS_URL || "https://test-fep.kashier.io/v3/orders/"
).replace(/\s+/g, "");

export type TokenChargeInput = {
  orderId: string; // our merchant order id (Payment.orderId)
  amount: number; // whole EGP (major units), as sent to the hosted checkout
  currency: string; // "EGP"
  customerReference: string; // stable per-user ref (== userId) the token is bound to
  cardToken: string; // decrypted Kashier card token
  webhookUrl?: string; // optional reconciliation webhook
};

export type TokenChargeResult =
  | { ok: true; captured: true; transactionId: string; cardToken?: string; raw: any }
  // needsAuth: the acquirer forced a step-up (3DS/OTP) — a silent MIT charge is not
  // possible; the caller must fall back to a customer-present renewal link.
  | { ok: false; needsAuth: true; error: string; raw?: any }
  | { ok: false; needsAuth?: false; error: string; raw?: any };

/** Order hash for the Kashier-Hash header. Documented (hosted) recipe:
 *  HMAC_SHA256("/?payment=mid.orderId.amount.currency.customerReference", apiKey).
 *  Must be re-verified for v3/orders (plan §9.3). */
function orderHash(
  merchantId: string, orderId: string, amount: string, currency: string,
  customerReference: string, apiKey: string,
): string {
  const path =
    `/?payment=${merchantId}.${orderId}.${amount}.${currency}.${customerReference}`;
  return crypto.createHmac("sha256", apiKey).update(path).digest("hex");
}

/** Charge a saved card token off-session (merchant-initiated / recurring). */
export async function payWithToken(input: TokenChargeInput): Promise<TokenChargeResult> {
  const { merchantId, apiKey, secretKey } = kashierCreds();
  if (!merchantId || !apiKey || !secretKey) {
    return { ok: false, error: "Kashier is not configured" };
  }
  const amount = String(input.amount);
  const hash = orderHash(
    merchantId, input.orderId, amount, input.currency, input.customerReference, apiKey,
  );

  const body: Record<string, unknown> = {
    apiOperation: "PAY",
    merchantId,
    order: { reference: input.orderId, amount, currency: input.currency },
    customer: { reference: input.customerReference },
    paymentMethod: {
      type: "CARD",
      card: { cardToken: input.cardToken },
      enable3DS: false, // MIT/recurring — no customer to complete a challenge
    },
    interactionSource: "Recurring",
    timestamp: new Date().toISOString(),
  };
  if (input.webhookUrl) {
    body.reconciliation = { webhookUrl: input.webhookUrl, redirect: false };
  }

  let raw: any = null;
  try {
    const res = await fetch(ORDERS_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: secretKey,
        "api-key": apiKey,
        "Kashier-Hash": hash,
      },
      body: JSON.stringify(body),
    });
    raw = await res.json().catch(() => ({}));
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `Kashier v3/orders HTTP ${res.status}`, raw };
    }
  } catch (e: any) {
    return { ok: false, error: `Kashier v3/orders request error: ${e?.message || e}` };
  }

  const response = raw?.response || {};
  const topOk = String(raw?.status || "").toUpperCase() === "SUCCESS";
  const result = String(response?.result || "").toUpperCase();
  const code = String(response?.transactionResponseCode ?? "");
  const captured =
    topOk && result === "SUCCESS" &&
    (code === "00" || String(response?.status || "").toUpperCase() === "CAPTURED");

  if (captured) {
    return {
      ok: true,
      captured: true,
      transactionId: String(response?.transactionId || response?.orderId || ""),
      cardToken: response?.paymentMethod?.card?.cardToken,
      raw,
    };
  }

  // Step-up demanded → cannot complete silently.
  const authState = String(response?.status || "").toUpperCase();
  const op = String(response?.operation || "").toLowerCase();
  if (authState.includes("AUTHENTICATION") || op.includes("3dsecure") || code === "AUTHENTICATION_IN_PROGRESS") {
    return {
      ok: false, needsAuth: true,
      error: response?.transactionResponseMessage?.en || "3DS/OTP required for this charge",
      raw,
    };
  }

  return {
    ok: false,
    error:
      response?.transactionResponseMessage?.en ||
      response?.transactionResponseMessage ||
      `declined (code ${code || "n/a"})`,
    raw,
  };
}
