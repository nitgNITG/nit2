// Kashier payment integration for the SaaS control plane (paid academy licences).
//
// Ported to match the Moodle payment provider exactly
// (saas-demo: public/local/payments/provider/kashier/classes/gateway.php) so the
// v3 sessions API call and the webhook HMAC verification are byte-for-byte
// compatible with what Kashier expects.
//
// Env (server-only):
//   KASHIER_MERCHANT_ID   MID-xxxx
//   KASHIER_API_KEY       the iframe/api key — used in the `api-key` header AND
//                         as the HMAC key for webhook signatures
//   KASHIER_SECRET_KEY    the secret — sent in the `Authorization` header
//   KASHIER_BASE_URL      default https://api.kashier.io
//   KASHIER_MODE          test | live (informational; base URL drives behaviour)

import crypto from "crypto";

const BASE_URL = (
  process.env.KASHIER_BASE_URL || "https://api.kashier.io"
).replace(/\/+$/, "");

function cfg() {
  const merchantId = process.env.KASHIER_MERCHANT_ID || "";
  const apiKey = process.env.KASHIER_API_KEY || "";
  const secretKey = process.env.KASHIER_SECRET_KEY || "";
  return { merchantId, apiKey, secretKey };
}

/** True only when all three Kashier credentials are configured. */
export function kashierConfigured(): boolean {
  const { merchantId, apiKey, secretKey } = cfg();
  console.log({ merchantId, apiKey, secretKey });

  return !!merchantId && !!apiKey && !!secretKey;
}

// PHP rawurlencode (RFC 3986): encodeURIComponent PLUS !*'() — Kashier's signature
// is built with PHP rawurlencode, so we must match it exactly or every signature
// check fails on values containing those characters.
function rawurlencode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export type CreateSessionInput = {
  orderId: string; // our merchant order id (Payment.orderId)
  amount: number; // whole currency units (e.g. EGP)
  currency: string; // EGP, USD, …
  displayLang?: "en" | "ar";
  customerReference: string; // our user id
  customerEmail: string;
  webhookUrl: string; // POST here on payment events
  successUrl: string; // client is redirected here after paying
  metadata?: Record<string, unknown>;
  maxFailureAttempts?: number;
};

export type CreateSessionResult =
  | { ok: true; sessionId: string; sessionUrl: string; raw: any }
  | { ok: false; error: string; raw?: any };

/** POST /v3/payment/sessions — create a hosted checkout session. */
export async function createSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const { merchantId, apiKey, secretKey } = cfg();
  if (!merchantId || !apiKey || !secretKey) {
    return {
      ok: false,
      error:
        "Kashier is not configured (KASHIER_MERCHANT_ID / API_KEY / SECRET_KEY)",
    };
  }

  const body: Record<string, unknown> = {
    amount: String(input.amount),
    currency: input.currency,
    display: input.displayLang || "en",
    merchantId,
    order: input.orderId,
    type: "one-time",
    allowedMethods: "card,wallet",
    enable3DS: true,
    serverWebhook: input.webhookUrl,
    merchantRedirect: input.successUrl,
    failureRedirect: true, // Kashier expects a boolean here, not a URL
    customer: {
      reference: input.customerReference,
      email: input.customerEmail,
    },
    metaData: { ...(input.metadata || {}), merchant_order_id: input.orderId },
  };
  if (input.maxFailureAttempts && input.maxFailureAttempts > 0) {
    body.maxFailureAttempts = input.maxFailureAttempts;
  }

  try {
    console.log("BASE_URL", BASE_URL);
    const res = await fetch(`${BASE_URL}/v3/payment/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: secretKey,
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    if (res.status < 200 || res.status >= 300) {
      return {
        ok: false,
        error: `Kashier session creation failed: HTTP ${res.status}`,
        raw,
      };
    }
    const sessionId = raw?._id || "";
    const sessionUrl = raw?.sessionUrl || "";
    if (!sessionUrl) {
      return { ok: false, error: "Kashier response missing sessionUrl", raw };
    }
    return { ok: true, sessionId, sessionUrl, raw };
  } catch (e: any) {
    return { ok: false, error: `Kashier request error: ${e?.message || e}` };
  }
}

export type WebhookVerdict = {
  signatureValid: boolean;
  eventType: string;
  merchantOrderId: string; // === our Payment.orderId
  kashierOrderId: string;
  transactionId: string;
  status: string; // SUCCESS | FAILED | …
  amount: number;
  currency: string;
  raw: any;
};

/**
 * Verify a Kashier webhook and extract the fields we act on.
 *
 * Signature algorithm (identical to the Moodle gateway):
 *   1. sort data.signatureKeys alphabetically
 *   2. build key=rawurlencode(value) joined by '&'
 *   3. HMAC-SHA256 with the API key
 *   4. constant-time compare the hex digest to the x-kashier-signature header
 */
export function verifyWebhook(
  payload: string,
  signatureHeader: string,
): WebhookVerdict {
  const empty: WebhookVerdict = {
    signatureValid: false,
    eventType: "",
    merchantOrderId: "",
    kashierOrderId: "",
    transactionId: "",
    status: "",
    amount: 0,
    currency: "",
    raw: null,
  };

  let parsed: any;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return empty;
  }
  const data = parsed?.data || {};
  const eventType = parsed?.event || "";
  const signature = (signatureHeader || "").trim();

  let signatureValid = false;
  const keys: string[] = Array.isArray(data?.signatureKeys)
    ? [...data.signatureKeys]
    : [];
  if (signature && keys.length) {
    keys.sort();
    const message = keys
      .map((k) => `${k}=${rawurlencode(String(data[k] ?? ""))}`)
      .join("&");
    const calculated = crypto
      .createHmac("sha256", cfg().apiKey)
      .update(message)
      .digest("hex");
    try {
      signatureValid =
        calculated.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(signature));
    } catch {
      signatureValid = false;
    }
  }

  return {
    signatureValid,
    eventType,
    merchantOrderId: String(data?.merchantOrderId ?? ""),
    kashierOrderId: String(data?.kashierOrderId ?? ""),
    transactionId: String(data?.transactionId ?? ""),
    status: String(data?.status ?? ""),
    amount: Number(data?.amount ?? 0),
    currency: String(data?.currency ?? ""),
    raw: parsed,
  };
}

/** A Kashier payment succeeded (status the webhook/verify reports on success). */
export function isPaidStatus(status: string): boolean {
  const s = (status || "").toUpperCase();
  return s === "SUCCESS" || s === "CAPTURED" || s === "PAID";
}
