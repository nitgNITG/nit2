// Shared platform integration accounts (Kashier / VDOCipher / Vimeo) and the
// per-package push. The actual credentials are NIT's own shared accounts, stored
// ONCE here (encrypted at rest via secretBox) and pushed into an academy's Moodle
// plugin config at provision + tier-change, based on its licence:
//   - videoSource === 'vdocipher' → local_vdocipher/*
//   - videoSource === 'vimeo'     → local_vimeo/*
//   - kashierEnabled === true     → paymentprovider_kashier/*
//
// Secrets are stored in PlatformSetting under an "int_" prefix. Secret fields are
// encrypted; plain fields (base URLs, sandbox flag, public client id) are not.
import prisma from "@/lib/prismaMysql";
import { encryptSecret, decryptSecret, credentialSecretConfigured } from "@/lib/secretBox";

type Field = { key: string; secret: boolean; label: string };

// short key (also the storage suffix: PlatformSetting.key = "int_" + key)
export const INTEGRATION_FIELDS: Field[] = [
    // Kashier (payment gateway) — TWO credential sets (live + test) plus a default
    // mode. Both sets are pushed to every academy; the active mode is chosen per
    // academy (owner-toggleable in their Moodle), defaulting to this platform mode.
    { key: "kashier_mode", secret: false, label: "Kashier default mode (live / test)" },
    // LIVE set (the existing kashier_* keys keep their stored values).
    { key: "kashier_merchant_id", secret: true, label: "LIVE — Kashier merchant id" },
    { key: "kashier_api_key", secret: true, label: "LIVE — Kashier API key" },
    { key: "kashier_secret_key", secret: true, label: "LIVE — Kashier secret key" },
    { key: "kashier_base_url", secret: false, label: "LIVE — Kashier base URL" },
    // TEST / sandbox set.
    { key: "kashier_test_merchant_id", secret: true, label: "TEST — Kashier merchant id" },
    { key: "kashier_test_api_key", secret: true, label: "TEST — Kashier API key" },
    { key: "kashier_test_secret_key", secret: true, label: "TEST — Kashier secret key" },
    { key: "kashier_test_base_url", secret: false, label: "TEST — Kashier base URL" },
    // VDOCipher (video DRM)
    { key: "vdocipher_apisecret", secret: true, label: "VDOCipher API secret" },
    { key: "vdocipher_apibase", secret: false, label: "VDOCipher API base" },
    // Vimeo (video)
    { key: "vimeo_access_token", secret: true, label: "Vimeo access token" },
    { key: "vimeo_client_id", secret: false, label: "Vimeo client id" },
    { key: "vimeo_client_secret", secret: true, label: "Vimeo client secret" },
    { key: "vimeo_apibase", secret: false, label: "Vimeo API base" },
];

const byKey = Object.fromEntries(INTEGRATION_FIELDS.map((f) => [f.key, f]));
const STORE_PREFIX = "int_";

/** Read + decrypt all integration secrets. Server-side only. */
export async function loadIntegrationSecrets(): Promise<Record<string, string>> {
    const rows = await prisma.platformSetting.findMany({
        where: { key: { startsWith: STORE_PREFIX } },
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
        const short = r.key.slice(STORE_PREFIX.length);
        const f = byKey[short];
        if (!f) continue;
        out[short] = f.secret ? (decryptSecret(r.value) ?? "") : r.value;
    }
    return out;
}

/** Masked view for the admin dashboard: secrets show only whether they're set. */
export async function loadIntegrationMasked(): Promise<Record<string, { set: boolean; value: string }>> {
    const secrets = await loadIntegrationSecrets();
    const out: Record<string, { set: boolean; value: string }> = {};
    for (const f of INTEGRATION_FIELDS) {
        const v = secrets[f.key] ?? "";
        out[f.key] = { set: v !== "", value: f.secret ? "" : v };
    }
    return out;
}

/** Full view WITH decrypted secret values — for an admin "reveal" action only.
 *  Never use this for a default page load; it puts plaintext secrets on the wire. */
export async function loadIntegrationRevealed(): Promise<Record<string, { set: boolean; value: string }>> {
    const secrets = await loadIntegrationSecrets();
    const out: Record<string, { set: boolean; value: string }> = {};
    for (const f of INTEGRATION_FIELDS) {
        const v = secrets[f.key] ?? "";
        out[f.key] = { set: v !== "", value: v };
    }
    return out;
}

/** Upsert integration settings from an admin PUT. Secrets are encrypted; an empty
 *  string for a secret field means "leave unchanged" (so re-saving the form
 *  without re-typing a secret doesn't wipe it). Plain fields set to "" clear. */
export async function saveIntegrationSettings(body: Record<string, unknown>): Promise<number> {
    // Refuse to save any secret when encryption is unavailable — otherwise
    // encryptSecret() returns null and the secret would be stored as an empty
    // string, silently discarding what the admin typed (the bug this guards).
    const hasSecretEdit = INTEGRATION_FIELDS.some(
        (f) => f.secret && f.key in body && String(body[f.key] ?? "") !== "",
    );
    if (hasSecretEdit && !credentialSecretConfigured()) {
        throw new Error("CREDENTIAL_SECRET is not set — cannot encrypt secrets. Set it in the app .env and restart.");
    }

    const ops = [];
    for (const f of INTEGRATION_FIELDS) {
        if (!(f.key in body)) continue;
        const raw = String(body[f.key] ?? "");
        if (f.secret && raw === "") continue; // don't overwrite a stored secret with blank
        let value: string;
        if (f.secret) {
            const enc = encryptSecret(raw);
            if (enc === null) {
                // Encryption unexpectedly failed even though a key is configured;
                // never fall back to storing plaintext or an empty value.
                throw new Error(`Could not encrypt ${f.key}`);
            }
            value = enc;
        } else {
            value = raw;
        }
        const storeKey = STORE_PREFIX + f.key;
        ops.push(
            prisma.platformSetting.upsert({
                where: { key: storeKey },
                update: { value },
                create: { key: storeKey, value },
            }),
        );
    }
    if (ops.length) await prisma.$transaction(ops);
    return ops.length;
}

export type IntegrationLicense = { videoSource: string; kashierEnabled: boolean };

/** Build the env map pushed to apply-integrations.sh for one academy, from the
 *  shared secrets + its licence. Only non-empty values are included, so a missing
 *  secret never blanks an academy's existing config. */
export async function buildIntegrationEnv(license: IntegrationLicense): Promise<Record<string, string>> {
    const s = await loadIntegrationSecrets();
    const env: Record<string, string> = { VIDEO_SOURCE: license.videoSource || "all" };

    if (license.videoSource === "vdocipher") {
        if (s.vdocipher_apisecret) env.VDOCIPHER_APISECRET = s.vdocipher_apisecret;
        if (s.vdocipher_apibase) env.VDOCIPHER_APIBASE = s.vdocipher_apibase;
    }
    if (license.videoSource === "vimeo") {
        if (s.vimeo_access_token) env.VIMEO_ACCESS_TOKEN = s.vimeo_access_token;
        if (s.vimeo_apibase) env.VIMEO_APIBASE = s.vimeo_apibase;
        if (s.vimeo_client_id) env.VIMEO_CLIENT_ID = s.vimeo_client_id;
        if (s.vimeo_client_secret) env.VIMEO_CLIENT_SECRET = s.vimeo_client_secret;
    }
    if (license.kashierEnabled) {
        env.KASHIER_ENABLED = "1";
        // Default mode pushed as the academy's default_payment_mode (the owner can
        // still override it). Both credential sets go so the toggle works locally.
        env.KASHIER_MODE = s.kashier_mode === "live" ? "live" : "test";
        if (s.kashier_merchant_id) env.KASHIER_LIVE_MERCHANT_ID = s.kashier_merchant_id;
        if (s.kashier_api_key) env.KASHIER_LIVE_API_KEY = s.kashier_api_key;
        if (s.kashier_secret_key) env.KASHIER_LIVE_SECRET_KEY = s.kashier_secret_key;
        if (s.kashier_base_url) env.KASHIER_LIVE_BASE_URL = s.kashier_base_url;
        if (s.kashier_test_merchant_id) env.KASHIER_TEST_MERCHANT_ID = s.kashier_test_merchant_id;
        if (s.kashier_test_api_key) env.KASHIER_TEST_API_KEY = s.kashier_test_api_key;
        if (s.kashier_test_secret_key) env.KASHIER_TEST_SECRET_KEY = s.kashier_test_secret_key;
        if (s.kashier_test_base_url) env.KASHIER_TEST_BASE_URL = s.kashier_test_base_url;
    }

    // Central revenue ledger: tell each academy where to mirror completed payments
    // (any provider). Independent of the licence's payment provider. No-op unless the
    // ingest secret is configured on the control plane.
    if (process.env.REVENUE_INGEST_SECRET) {
        env.REVENUE_INGEST_SECRET = process.env.REVENUE_INGEST_SECRET;
        const url =
            process.env.REVENUE_INGEST_URL ||
            `${(process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "")}/api/revenue/ingest`;
        if (url && !url.startsWith("/")) env.REVENUE_INGEST_URL = url;
    }
    return env;
}

/** True if there's anything worth pushing (avoids a no-op provisioning call). */
export function hasIntegrationPayload(env: Record<string, string>): boolean {
    return Object.keys(env).some((k) => k !== "VIDEO_SOURCE");
}
