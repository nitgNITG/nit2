// Small symmetric encryption helper for secrets we must be able to READ BACK
// (e.g. the generated academy admin password, so a lost welcome email can be
// recovered). AES-256-GCM (authenticated) with a key derived from the
// CREDENTIAL_SECRET env var. This is NOT for user login passwords — those stay
// one-way hashed in Moodle and are never stored here.
//
// Set CREDENTIAL_SECRET to a long random string in the app .env. If it is unset,
// encryption is disabled: encryptSecret returns null and callers simply store
// nothing (the feature degrades to "no saved password" rather than storing
// plaintext).
import crypto from "crypto";

const SECRET = process.env.CREDENTIAL_SECRET || "";

function key(): Buffer | null {
    if (!SECRET) return null;
    // Derive a stable 32-byte key from the configured secret.
    return crypto.createHash("sha256").update(SECRET, "utf8").digest();
}

export function credentialSecretConfigured(): boolean {
    return !!SECRET;
}

/** Encrypt to "v1:iv:tag:cipher" (all hex). Returns null if no key or empty input. */
export function encryptSecret(plain: string): string | null {
    const k = key();
    if (!k || !plain) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt a "v1:…" blob. Returns null on any problem (missing key, tampering, bad format). */
export function decryptSecret(blob: string | null | undefined): string | null {
    const k = key();
    if (!k || !blob) return null;
    try {
        const [v, ivh, tagh, dh] = blob.split(":");
        if (v !== "v1" || !ivh || !tagh || !dh) return null;
        const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivh, "hex"));
        decipher.setAuthTag(Buffer.from(tagh, "hex"));
        return Buffer.concat([decipher.update(Buffer.from(dh, "hex")), decipher.final()]).toString("utf8");
    } catch {
        return null;
    }
}

/** A friendly generated admin password, e.g. "Nit-a1b2c3d4e5f6". */
export function generateAdminPassword(): string {
    return "Nit-" + crypto.randomBytes(6).toString("hex");
}
