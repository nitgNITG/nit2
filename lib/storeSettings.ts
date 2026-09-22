// Store (commerce) platform settings — the counterpart of PLATFORM_KEYS /
// lib/integrations.ts for the store product. Two kinds of value live here:
//
//   * control-plane knobs read by nit2 itself (free quota, daily IP cap, the NIT
//     support login e-mail) — PlatformSetting rows, plain;
//   * host configuration that used to be edited by hand in the provisioner's
//     provision.env (auto-update, welcome-mail SMTP, Cloudinary, Google login,
//     container memory) — stored here (secrets encrypted via secretBox) and PUSHED
//     to the store host with pushStoreSettingsToHost() → provisioner POST /config,
//     which rewrites provision.env and re-applies the per-store keys to every
//     running store.
//
// Storage key = "store_" + key. Secrets follow the integrations rule: never saved
// when CREDENTIAL_SECRET is unset, blank on PUT = keep the stored value.
import prisma from "@/lib/prismaMysql";
import { encryptSecret, decryptSecret, credentialSecretConfigured } from "@/lib/secretBox";
import { storeProvisionerCall } from "@/lib/products/store";

export type StoreField = {
    key: string;
    label: string;
    secret?: boolean;
    /** provision.env key this value is pushed to (absent = nit2-only). */
    host?: string;
    /** PlatformSetting key when it is not "store_" + key (legacy keys the gates already read). */
    storageKey?: string;
    hint?: string;
    placeholder?: string;
    group: "creation" | "updates" | "mail" | "cloudinary" | "google" | "resources";
};

export const STORE_FIELDS: StoreField[] = [
    // ── nit2-only ────────────────────────────────────────────────────────────
    { group: "creation", key: "free_limit", storageKey: "free_store_limit", label: "Free stores per account", hint: "How many free-plan stores one user may create. -1 = unlimited.", placeholder: "1" },
    { group: "creation", key: "daily_ip_limit", storageKey: "stores_daily_ip_limit", label: "Max stores per IP per day", hint: "0 = no cap. Default 5.", placeholder: "5" },
    { group: "creation", key: "nit_admin_email", label: "NIT support login e-mail", hint: "The hidden platform user created in every store (Credentials → NIT login). Blank = support@nitg-eg.com.", placeholder: "support@nitg-eg.com" },
    // ── pushed to the host ──────────────────────────────────────────────────
    { group: "updates", key: "auto_update", label: "Auto-update to the newest release", host: "AUTO_UPDATE", hint: "1 = every store follows the newest X.Y.Z tag on the registry; 0 = only CI / the dashboard move stores.", placeholder: "1" },
    { group: "updates", key: "auto_update_minutes", label: "Check every (minutes)", host: "AUTO_UPDATE_MINUTES", placeholder: "15" },
    { group: "mail", key: "mail_host", label: "SMTP host", host: "MAIL_HOST", hint: "Sends the store welcome / owner-reset mails from inside each store.", placeholder: "smtp.gmail.com" },
    { group: "mail", key: "mail_port", label: "SMTP port", host: "MAIL_PORT", placeholder: "587" },
    { group: "mail", key: "mail_user", label: "SMTP user", host: "MAIL_USER", placeholder: "nit.eg.co@gmail.com" },
    { group: "mail", key: "mail_pass", label: "SMTP password", host: "MAIL_PASS", secret: true, hint: "Gmail: an App Password. Blank keeps the stored value." },
    { group: "mail", key: "mail_from", label: "From", host: "MAIL_FROM", placeholder: "N.I.T <nit.eg.co@gmail.com>" },
    { group: "cloudinary", key: "cloudinary_cloud_name", label: "Cloud name", host: "CLOUDINARY_CLOUD_NAME", hint: "Store logos and product images. Each store uploads under stores/<slug>." },
    { group: "cloudinary", key: "cloudinary_api_key", label: "API key", host: "CLOUDINARY_API_KEY" },
    { group: "cloudinary", key: "cloudinary_api_secret", label: "API secret", host: "CLOUDINARY_API_SECRET", secret: true },
    { group: "google", key: "google_web_client_id", label: "Google web client id", host: "GOOGLE_WEB_CLIENT_ID", hint: "\"Sign in with Google\" on every storefront. Add https://<slug>.commerce.nitg-eg.com to the OAuth client's authorized origins." },
    { group: "google", key: "google_client_secret", label: "Google client secret", host: "GOOGLE_CLIENT_SECRET", secret: true },
    { group: "google", key: "account_url", label: "Account URL", host: "ACCOUNT_URL", hint: "Where a store's \"manage subscription\" link points. Blank = https://<nit2>/account.", placeholder: "https://dev.nitg-eg.com/account" },
    { group: "resources", key: "max_image_mb", label: "Max upload image (MB)", host: "MAX_IMAGE_MB", placeholder: "5" },
    { group: "resources", key: "api_mem", label: "API container memory", host: "API_MEM", hint: "Per store. Applied on the next container recreate.", placeholder: "384m" },
    { group: "resources", key: "site_mem", label: "Storefront container memory", host: "SITE_MEM", placeholder: "256m" },
    { group: "resources", key: "dash_mem", label: "Dashboard container memory", host: "DASH_MEM", placeholder: "192m" },
];

const PREFIX = "store_";
const storageKey = (f: StoreField) => f.storageKey ?? PREFIX + f.key;
const byStorageKey = Object.fromEntries(STORE_FIELDS.map((f) => [storageKey(f), f]));

/** Decrypted values, server-side only. Missing keys are absent (not ""). */
export async function loadStoreSettings(): Promise<Record<string, string>> {
    const rows = await prisma.platformSetting.findMany({ where: { key: { in: Object.keys(byStorageKey) } } });
    const out: Record<string, string> = {};
    for (const r of rows) {
        const f = byStorageKey[r.key];
        if (!f) continue;
        out[f.key] = f.secret ? (decryptSecret(r.value) ?? "") : r.value;
    }
    return out;
}

/** Masked view for the admin form: secrets only say whether they are set. */
export async function loadStoreSettingsMasked(): Promise<Record<string, { set: boolean; value: string }>> {
    const s = await loadStoreSettings();
    return Object.fromEntries(STORE_FIELDS.map((f) => {
        const v = s[f.key] ?? "";
        return [f.key, { set: v !== "", value: f.secret ? "" : v }];
    }));
}

/** Upsert from an admin PUT. Same rules as integrations: secrets are encrypted,
 *  blank secret = keep, and nothing is saved when encryption is unavailable. */
export async function saveStoreSettings(body: Record<string, unknown>): Promise<number> {
    const hasSecretEdit = STORE_FIELDS.some((f) => f.secret && f.key in body && String(body[f.key] ?? "") !== "");
    if (hasSecretEdit && !credentialSecretConfigured()) {
        throw new Error("CREDENTIAL_SECRET is not set — cannot encrypt secrets. Set it in the app .env and restart.");
    }
    const ops = [];
    for (const f of STORE_FIELDS) {
        if (!(f.key in body)) continue;
        const raw = String(body[f.key] ?? "").trim();
        if (f.secret && raw === "") continue;
        if (f.key === "free_limit" || f.key === "daily_ip_limit" || f.key === "auto_update_minutes" || f.key === "max_image_mb" || f.key === "mail_port") {
            if (raw !== "" && !/^-?\d+$/.test(raw)) throw new Error(`${f.label}: must be a whole number`);
        }
        if (f.key === "auto_update" && raw !== "" && !["0", "1"].includes(raw)) throw new Error("Auto-update: use 1 or 0");
        let value = raw;
        if (f.secret) {
            const enc = encryptSecret(raw);
            if (enc === null) throw new Error(`Could not encrypt ${f.key}`);
            value = enc;
        }
        const key = storageKey(f);
        ops.push(prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } }));
    }
    if (ops.length) await prisma.$transaction(ops);
    return ops.length;
}

/** The provision.env key/values to push. Only non-empty values are sent, so a
 *  setting never typed here does not blank what is on the host. */
export async function buildHostConfig(): Promise<Record<string, string>> {
    const s = await loadStoreSettings();
    const out: Record<string, string> = {};
    for (const f of STORE_FIELDS) {
        if (!f.host) continue;
        const v = s[f.key];
        if (v !== undefined && v !== "") out[f.host] = v;
    }
    return out;
}

/** Push the host settings to the store provisioner (POST /config). The host
 *  rewrites provision.env and re-applies the per-store keys to running stores. */
export async function pushStoreSettingsToHost(): Promise<{ ok: true; changed: string[]; stores: number } | { ok: false; error: string }> {
    const values = await buildHostConfig();
    if (Object.keys(values).length === 0) return { ok: false, error: "nothing to push — no host settings saved yet" };
    const r = await storeProvisionerCall<{ ok: boolean; changed: string[]; stores: number }>("/config", { body: { values }, timeoutMs: 30_000 });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, changed: r.data?.changed ?? [], stores: r.data?.stores ?? 0 };
}

/** The NIT support login e-mail for new stores (settings → env → default). */
export async function nitAdminEmail(): Promise<string> {
    const row = await prisma.platformSetting.findUnique({ where: { key: PREFIX + "nit_admin_email" } }).catch(() => null);
    return (row?.value || process.env.STORE_NIT_ADMIN_EMAIL || "support@nitg-eg.com").trim().toLowerCase();
}
