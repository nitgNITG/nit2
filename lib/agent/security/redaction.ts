// Redaction (NFR-22, §13.16). Audit records and logs never hold API keys, tokens,
// cookies, card data, passwords or OTP codes; emails and phone numbers are masked.

const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|otp|^code$|card|cvv|cvc|pan|iban/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// 12+ digits (cards, account numbers), allowing spaces/dashes between groups.
const LONG_DIGITS = /\b(?:\d[ -]?){12,}\d\b/g;
// Phone-like: optional +, 8–15 digits with separators.
const PHONE = /\+?\d(?:[\s-]?\d){7,14}/g;
// Bearer / sk-… style secrets inside free text.
const INLINE_SECRET = /\b(?:Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;

export const REDACTED = "[redacted]";

export function redactText(s: string): string {
    return s
        .replace(INLINE_SECRET, REDACTED)
        .replace(LONG_DIGITS, REDACTED)
        .replace(EMAIL, (_m, first: string, domain: string) => `${first}***@${domain}`)
        .replace(PHONE, (m) => {
            const digits = m.replace(/\D/g, "");
            return `***${digits.slice(-3)}`;
        });
}

/** Deep copy with secret-named keys replaced and PII in strings masked. */
export function redact<T>(value: T, depth = 0): T {
    if (depth > 8) return REDACTED as unknown as T;
    if (typeof value === "string") return redactText(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1)) as unknown as T;
    if (value && typeof value === "object" && !(value instanceof Date)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SECRET_KEY.test(k) ? REDACTED : redact(v, depth + 1);
        }
        return out as T;
    }
    return value;
}
