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
import { encryptSecret, decryptSecret } from "@/lib/secretBox";

type Field = { key: string; secret: boolean; label: string };

// short key (also the storage suffix: PlatformSetting.key = "int_" + key)
export const INTEGRATION_FIELDS: Field[] = [
    // Kashier (payment gateway)
    { key: "kashier_merchant_id", secret: true, label: "Kashier merchant id" },
    { key: "kashier_api_key", secret: true, label: "Kashier API key" },
    { key: "kashier_secret_key", secret: true, label: "Kashier secret key" },
    { key: "kashier_sandbox", secret: false, label: "Kashier sandbox mode (1=test, 0=live)" },
    { key: "kashier_base_url", secret: false, label: "Kashier base URL" },
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

/** Upsert integration settings from an admin PUT. Secrets are encrypted; an empty
 *  string for a secret field means "leave unchanged" (so re-saving the form
 *  without re-typing a secret doesn't wipe it). Plain fields set to "" clear. */
export async function saveIntegrationSettings(body: Record<string, unknown>): Promise<number> {
    const ops = [];
    for (const f of INTEGRATION_FIELDS) {
        if (!(f.key in body)) continue;
        const raw = String(body[f.key] ?? "");
        if (f.secret && raw === "") continue; // don't overwrite a stored secret with blank
        const value = f.secret ? (encryptSecret(raw) ?? "") : raw;
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
        if (s.kashier_merchant_id) env.KASHIER_MERCHANT_ID = s.kashier_merchant_id;
        if (s.kashier_api_key) env.KASHIER_API_KEY = s.kashier_api_key;
        if (s.kashier_secret_key) env.KASHIER_SECRET_KEY = s.kashier_secret_key;
        env.KASHIER_SANDBOX = s.kashier_sandbox || "1";
        if (s.kashier_base_url) env.KASHIER_BASE_URL = s.kashier_base_url;
    }
    return env;
}

/** True if there's anything worth pushing (avoids a no-op provisioning call). */
export function hasIntegrationPayload(env: Record<string, string>): boolean {
    return Object.keys(env).some((k) => k !== "VIDEO_SOURCE");
}
