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
import prisma from "@/lib/prismaMysql";

export type CheckoutMode = "live" | "test";

// Next loads .env through dotenv-expand, which TRUNCATES a value at any
// unescaped `$` (it reads it as a variable reference). Kashier secrets often
// contain `$`, so we support a base64 fallback that can never be truncated: set
// <VAR>_B64 to base64(value) and it wins.
function fromB64(v: string): string {
  try {
    return Buffer.from(v, "base64").toString("utf8");
  } catch {
    return "";
  }
}
function env(name: string): string {
  const b64 = process.env[`${name}_B64`];
  return (b64 ? fromB64(b64) : process.env[name]) || "";
}

// The mode the legacy single KASHIER_* env set belongs to (so existing deployments
// keep working). KASHIER_MODE=live|test; defaults to test.
function legacyMode(): CheckoutMode {
  return (process.env.KASHIER_MODE || "").toLowerCase() === "live" ? "live" : "test";
}

// Credentials for one mode: the mode-specific env set (KASHIER_LIVE_* / KASHIER_TEST_*),
// falling back to the legacy KASHIER_* set for whichever mode it belongs to.
function cfgFor(mode: CheckoutMode): { merchantId: string; apiKey: string; secretKey: string; baseUrl: string } {
  const P = mode === "live" ? "KASHIER_LIVE_" : "KASHIER_TEST_";
  let merchantId = env(`${P}MERCHANT_ID`);
  let apiKey = env(`${P}API_KEY`);
  let secretKey = env(`${P}SECRET_KEY`);
  let baseUrl = env(`${P}BASE_URL`);
  if (mode === legacyMode()) {
    merchantId ||= env("KASHIER_MERCHANT_ID");
    apiKey ||= env("KASHIER_API_KEY");
    secretKey ||= env("KASHIER_SECRET_KEY");
    baseUrl ||= env("KASHIER_BASE_URL");
  }
  if (!baseUrl) baseUrl = mode === "test" ? "https://test-api.kashier.io" : "https://api.kashier.io";
  return { merchantId, apiKey, secretKey, baseUrl: baseUrl.replace(/\/+$/, "") };
}

// The active checkout mode for NIT's OWN licence payments. The DB toggle
// (PlatformSetting "checkout_mode") wins; env KASHIER_MODE is the fallback default.
export async function checkoutMode(): Promise<CheckoutMode> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: "checkout_mode" } });
    const v = (row?.value || "").toLowerCase();
    if (v === "live" || v === "test") return v;
  } catch {
    /* DB unavailable → fall back to env */
  }
  return legacyMode();
}

/** Resolved creds + base URL + mode for the active checkout mode. */
export async function resolveCheckout(): Promise<{ mode: CheckoutMode; merchantId: string; apiKey: string; secretKey: string; baseUrl: string }> {
  const mode = await checkoutMode();
  return { mode, ...cfgFor(mode) };
}

/** Which modes have all three credentials configured (for the settings UI). */
export function checkoutConfigured(): { live: boolean; test: boolean } {
  const ok = (m: CheckoutMode) => {
    const c = cfgFor(m);
    return !!c.merchantId && !!c.apiKey && !!c.secretKey;
  };
  return { live: ok("live"), test: ok("test") };
}

/** True when the ACTIVE mode's credentials are all configured. */
export async function kashierConfigured(): Promise<boolean> {
  const { merchantId, apiKey, secretKey } = await resolveCheckout();
  return !!merchantId && !!apiKey && !!secretKey;
}

/** The resolved Kashier credentials for the active mode. Async now (mode is a DB
 *  toggle). Used by the direct-order module (lib/kashierOrders.ts). */
export async function kashierCreds(): Promise<{ merchantId: string; apiKey: string; secretKey: string }> {
  const { merchantId, apiKey, secretKey } = await resolveCheckout();
  return { merchantId, apiKey, secretKey };
}

/** Both modes' API keys (for signature checks that can't read the DB toggle — a
 *  callback/webhook must verify against whichever mode created it). */
export function candidateApiKeys(): string[] {
  return Array.from(new Set([cfgFor("live").apiKey, cfgFor("test").apiKey].filter(Boolean)));
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
  // Ask the hosted checkout to save the card on file (card-on-file), so the
  // returned token can be reused for recurring/auto-renew charges. Sends the
  // Kashier session `saveCard` field (default mode "optional"; override with
  // KASHIER_SAVE_CARD_MODE). Off unless explicitly requested.
  saveCard?: boolean;
};

export type CreateSessionResult =
  | { ok: true; sessionId: string; sessionUrl: string; mode: CheckoutMode; raw: any }
  | { ok: false; error: string; raw?: any };

/** POST /v3/payment/sessions — create a hosted checkout session in the active mode. */
export async function createSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  const { mode, merchantId, apiKey, secretKey, baseUrl: BASE_URL } = await resolveCheckout();
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
    // saveCard tells the checkout to store the card for reuse; retrieveSavedCard
    // shows the customer their previously-saved cards. Only when requested.
    ...(input.saveCard
      ? {
          saveCard: process.env.KASHIER_SAVE_CARD_MODE || "optional",
          retrieveSavedCard: true,
        }
      : {}),
  };
  if (input.maxFailureAttempts && input.maxFailureAttempts > 0) {
    body.maxFailureAttempts = input.maxFailureAttempts;
  }

  try {
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
    return { ok: true, sessionId, sessionUrl, mode, raw };
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
    // Try BOTH modes' API keys — a webhook for a live payment must verify against
    // the live key even if the toggle later flips to test (and vice-versa). This is
    // sync (no DB), so we can't read the toggle here; matching either key is correct
    // because only the mode that created the session could have produced the digest.
    const candidateKeys = Array.from(
      new Set([cfgFor("live").apiKey, cfgFor("test").apiKey].filter(Boolean)),
    );
    for (const key of candidateKeys) {
      const calculated = crypto.createHmac("sha256", key).update(message).digest("hex");
      try {
        if (
          calculated.length === signature.length &&
          crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(signature))
        ) {
          signatureValid = true;
          break;
        }
      } catch {
        /* length mismatch → not this key */
      }
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
