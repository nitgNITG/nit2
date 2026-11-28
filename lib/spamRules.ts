// Spam rules shared by the contact form (app/api/contact) and the AI agent's
// capture_lead tool (FR-S5) — one list, so both refuse the same addresses.

// ── Disposable / known-spam email domains ─────────────────────────────────────
export const BLOCKED_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
    'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'trashmail.me',
    'trashmail.at', 'trashmail.io', 'trashmail.xyz', 'fakeinbox.com',
    'dispostable.com', 'mailnull.com', 'maildrop.cc', 'spamgourmet.com',
    '10minutemail.com', 'temp-mail.org', 'getnada.com', 'discard.email',
    'spamhereplease.com', 'spamthisplease.com',
]);

export function isBlockedEmailDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return !domain || BLOCKED_DOMAINS.has(domain);
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
    return email.length <= 200 && EMAIL_RE.test(email);
}

/** Digits-only E.164-ish phone: optional +, 7–15 digits once separators are removed. */
export function normalizePhone(raw: string): string | null {
    const trimmed = raw.trim();
    if (!/^\+?[\d\s\-().]{7,25}$/.test(trimmed)) return null;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    return trimmed.startsWith('+') ? `+${digits}` : digits;
}
