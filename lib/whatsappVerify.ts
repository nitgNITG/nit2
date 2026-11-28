// Reverse WhatsApp verification for contact-form leads.
//
// The WhatsApp Cloud API has no "does this number have WhatsApp" lookup (and
// unofficial checkers break WhatsApp's terms), so we turn it around: the visitor
// sends NIT a WhatsApp message containing a one-time code; when Meta's webhook
// (app/api/whatsapp/webhook) delivers it, the lead is verified and the sender's
// real WhatsApp number is stored.
//
// Dormant unless all three env vars are set — see whatsappVerifyConfig().

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type WhatsappVerifyConfig = {
    /** NIT's WhatsApp number, digits only (e.g. 201091568240). */
    number: string;
    /** Meta app secret — signs every webhook delivery (X-Hub-Signature-256). */
    appSecret: string;
    /** Our own token, echoed back by Meta in the GET subscription handshake. */
    webhookVerifyToken: string;
};

/** How long a lead has to send its code. */
export const VERIFY_TTL_DAYS = 7;
export const VERIFY_TTL_MS = VERIFY_TTL_DAYS * 24 * 60 * 60 * 1000;

/** null = feature off: the contact form and API behave exactly as before. */
export function whatsappVerifyConfig(): WhatsappVerifyConfig | null {
    const number = (process.env.WHATSAPP_VERIFY_NUMBER ?? "").replace(/\D/g, "");
    const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
    const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "";
    if (!number || !appSecret || !webhookVerifyToken) return null;
    return { number, appSecret, webhookVerifyToken };
}

// ── Codes ─────────────────────────────────────────────────────────────────────

/** 32 characters — no 0/O or 1/I, so a code read aloud or retyped can't be misread. */
export const VERIFY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;

/** "NIT-" + 6 crypto-random characters (32^6 ≈ 1.07e9 codes, no modulo bias: 256 % 32 = 0). */
export function newVerifyCode(): string {
    const bytes = randomBytes(CODE_LEN);
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += VERIFY_CODE_ALPHABET[bytes[i] % VERIFY_CODE_ALPHABET.length];
    return `NIT-${out}`;
}

// "NIT", optional separator, 6 code characters — not glued to other Latin letters
// or digits (Arabic text right next to it is fine).
const CODE_RE = /(?<![A-Za-z0-9])NIT\s*([-‐-―_:.]?)\s*([A-HJ-NP-Z2-9]{6})(?![A-Za-z0-9])/gi;

function findCodes(text: string): { code: string; asIssued: boolean }[] {
    if (typeof text !== "string" || !text) return [];
    return Array.from(toAsciiDigits(text).matchAll(CODE_RE)).map((m) => ({
        code: `NIT-${m[2].toUpperCase()}`,
        asIssued: /^[-‐-―]$/.test(m[1]), // written with a dash, the way we issue it
    }));
}

/**
 * Every code-shaped candidate in a message, upper-cased, de-duplicated, in order of
 * appearance. The webhook tries each, because "NIT please …" is also code-shaped.
 */
export function extractVerifyCodes(text: string): string[] {
    return Array.from(new Set(findCodes(text).map((f) => f.code)));
}

/** The code most likely meant (case-insensitive; tolerates surrounding text), or null. */
export function extractVerifyCode(text: string): string | null {
    const found = findCodes(text);
    return (found.find((f) => f.asIssued) ?? found[0])?.code ?? null;
}

/** wa.me link that opens a chat with NIT, prefilled with a short message carrying the code. */
export function verifyLink(code: string, locale: "ar" | "en" | string, number?: string): string {
    const to = (number ?? whatsappVerifyConfig()?.number ?? "").replace(/\D/g, "");
    if (!to) throw new Error("whatsappVerify: no WhatsApp number configured");
    const text = locale === "en"
        ? `Hello N.I.T, I'm confirming my WhatsApp number. My code: ${code}`
        : `مرحباً N.I.T، أؤكد رقمي على واتساب. رمز التأكيد: ${code}`;
    return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// ── Webhook signature ────────────────────────────────────────────────────────

/** Meta signs the raw body: X-Hub-Signature-256: sha256=<hex HMAC-SHA256(appSecret, body)>. */
export function isValidSignature(rawBody: string | Buffer, headerValue: string | null | undefined, secret: string): boolean {
    if (!secret || typeof headerValue !== "string") return false;
    const m = /^sha256=([0-9a-f]{64})$/i.exec(headerValue.trim());
    if (!m) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const given = Buffer.from(m[1], "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
}

// ── Phone sanity check ───────────────────────────────────────────────────────
//
// Rejecting a real lead is worse than accepting a typo, so this only catches the
// clearly impossible: strict mobile patterns for Egypt / Saudi / UAE (where nearly
// all our leads come from), and a plain 7–15 digit length check for the rest.

const ARABIC_DIGITS = /[٠-٩۰-۹]/g; // Arabic-Indic + Eastern Arabic (Persian) digits

function toAsciiDigits(s: string): string {
    return s.replace(ARABIC_DIGITS, (d) => {
        const c = d.charCodeAt(0);
        return String(c >= 0x06f0 ? c - 0x06f0 : c - 0x0660);
    });
}

const MOBILE: Record<"eg" | "sa" | "ae", { cc: string; re: RegExp }> = {
    eg: { cc: "20", re: /^1[0125]\d{8}$/ },  // +20 10/11/12/15 + 8 digits
    sa: { cc: "966", re: /^5\d{8}$/ },        // +966 5 + 8 digits
    ae: { cc: "971", re: /^5\d{8}$/ },        // +971 5 + 8 digits
};

/**
 * `digits` is the national number for eg/sa/ae (what follows the country code),
 * the full number otherwise. Spaces, dashes and Arabic-Indic digits are fine; a
 * trunk 0 or the country code typed a second time is forgiven.
 */
export function isPlausiblePhone(country: string | null | undefined, digits: string): boolean {
    if (typeof digits !== "string") return false;
    const d = toAsciiDigits(digits).replace(/\D/g, "");
    const rule = country && Object.prototype.hasOwnProperty.call(MOBILE, country) ? MOBILE[country as keyof typeof MOBILE] : null;
    if (!rule) return d.length >= 7 && d.length <= 15;
    const candidates = [d, d.replace(/^0/, "")];
    if (d.startsWith(rule.cc)) {
        const rest = d.slice(rule.cc.length);
        candidates.push(rest, rest.replace(/^0/, ""));
    }
    return candidates.some((c) => rule.re.test(c));
}

/** Split the form's `${dialCode}${number}` into country (by international prefix) and the rest. */
export function splitPhone(phone: string): { country: "eg" | "sa" | "ae" | "other"; national: string } {
    const s = toAsciiDigits(String(phone ?? "")).trim();
    const international = s.startsWith("+") || s.startsWith("00");
    let digits = s.replace(/\D/g, "");
    if (!international) return { country: "other", national: digits };
    if (s.startsWith("00")) digits = digits.slice(2);
    for (const [country, { cc }] of Object.entries(MOBILE) as ["eg" | "sa" | "ae", { cc: string }][]) {
        if (digits.startsWith(cc)) return { country, national: digits.slice(cc.length) };
    }
    return { country: "other", national: digits };
}

/** The contact route's check on the submitted phone string. */
export function isPlausibleLeadPhone(phone: string): boolean {
    if (typeof phone !== "string" || !phone.trim()) return false;
    const { country, national } = splitPhone(phone);
    return isPlausiblePhone(country, national);
}
