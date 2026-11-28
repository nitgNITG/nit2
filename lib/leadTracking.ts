// First-party lead tracking, browser side. Records that a visitor *acted*
// (clicked WhatsApp / a phone number, or submitted the contact / quote form) —
// never who they are: no name, email, phone, IP or user agent is sent.
// The server half is lib/leadEvents.ts + app/api/track.

export const LEAD_EVENT_TYPES = ["whatsapp_click", "phone_click", "contact_submit", "quote_submit"] as const;
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number];
export type LeadLocale = "ar" | "en";

export type LeadPayload = {
    type: LeadEventType;
    page: string;
    locale: LeadLocale;
    referrerHost?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
};

export const TRACK_URL = "/api/track";

/** Every page lives under /ar or /en; anything else is the Arabic default. */
export function localeFromPath(pathname: string): LeadLocale {
    return /^\/en(\/|$)/.test(pathname) ? "en" : "ar";
}

/** Signed-in areas — the admin clicking a lead's WhatsApp there is not a lead. */
export function isPrivatePath(pathname: string): boolean {
    return /^(\/(ar|en))?\/(dashboard|account|payment)(\/|$)/.test(pathname);
}

const WHATSAPP_HOSTS = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);

/** Which lead event (if any) following this link counts as. */
export function leadTypeForHref(href: string): LeadEventType | null {
    const h = href.trim().toLowerCase();
    if (h.startsWith("tel:")) return "phone_click";
    if (h.startsWith("whatsapp:")) return "whatsapp_click";
    try {
        const u = new URL(h);
        if ((u.protocol === "https:" || u.protocol === "http:") && WHATSAPP_HOSTS.has(u.hostname.replace(/^www\./, ""))) {
            return "whatsapp_click";
        }
    } catch {
        // relative or malformed href — not a lead link
    }
    return null;
}

const opt = (v: string | null | undefined, max: number) => (v && v.trim() ? v.trim().slice(0, max) : undefined);

export function buildLeadPayload(
    type: LeadEventType,
    location: { pathname: string; search: string },
    referrer: string,
): LeadPayload {
    const params = new URLSearchParams(location.search);
    let referrerHost: string | undefined;
    try {
        referrerHost = referrer ? new URL(referrer).hostname || undefined : undefined;
    } catch {
        referrerHost = undefined;
    }
    const payload: LeadPayload = { type, page: location.pathname.slice(0, 300), locale: localeFromPath(location.pathname) };
    const extra = {
        referrerHost,
        utmSource: opt(params.get("utm_source"), 100),
        utmMedium: opt(params.get("utm_medium"), 100),
        utmCampaign: opt(params.get("utm_campaign"), 100),
    };
    for (const [k, v] of Object.entries(extra)) if (v) (payload as Record<string, string>)[k] = v;
    return payload;
}

/**
 * Fire-and-forget: survives the page unloading (WhatsApp links navigate away)
 * and never throws — tracking must not break a click or a form.
 */
export function trackLead(type: LeadEventType): void {
    try {
        if (typeof window === "undefined") return;
        const body = JSON.stringify(buildLeadPayload(type, window.location, document.referrer));
        // A string body goes as text/plain — no CORS preflight, which a beacon can't do.
        if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(TRACK_URL, body)) return;
        void fetch(TRACK_URL, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain;charset=UTF-8" } })
            .catch(() => {});
    } catch {
        // never let tracking surface to the visitor
    }
}
