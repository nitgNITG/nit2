// Search-console verification and Google Analytics 4 — all env-driven and inert
// when the variable is empty (no tag, no script). See .env.example for where each
// value comes from.
import type { Metadata } from "next";

type Env = Record<string, string | undefined>;
const clean = (v: string | undefined) => (v ?? "").trim();

/**
 * Root-layout `metadata.verification`: GOOGLE_SITE_VERIFICATION → google-site-verification,
 * BING_SITE_VERIFICATION → msvalidate.01, YANDEX_VERIFICATION → yandex-verification.
 * Undefined when none is set, so no tag is rendered.
 */
export function siteVerification(env: Env = process.env): Metadata["verification"] | undefined {
    const google = clean(env.GOOGLE_SITE_VERIFICATION);
    const bing = clean(env.BING_SITE_VERIFICATION);
    const yandex = clean(env.YANDEX_VERIFICATION);
    const v: NonNullable<Metadata["verification"]> = {};
    if (google) v.google = google;
    if (yandex) v.yandex = yandex;
    if (bing) v.other = { "msvalidate.01": bing };
    return Object.keys(v).length ? v : undefined;
}

/** A GA4 measurement id ("G-XXXXXXXXXX"), or null when unset/malformed (then nothing loads). */
export function gaMeasurementId(raw: string | undefined): string | null {
    const id = clean(raw).toUpperCase();
    return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

// Where Google Consent Mode v2 starts everything "denied": the EEA (EU-27 + Iceland,
// Liechtenstein, Norway), the UK and Switzerland. ISO 3166-1 alpha-2.
export const CONSENT_DENIED_REGIONS = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
    "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    "IS", "LI", "NO",
    "GB", "CH",
] as const;

/**
 * Inline gtag bootstrap: Consent Mode v2 defaults, then config. Must run before
 * gtag.js processes the dataLayer (it does — both only push onto it).
 * UK/EEA/CH: everything denied (cookieless pings only). Elsewhere: analytics
 * granted, all ad signals denied. No cookie banner, so nothing ever upgrades it.
 */
export function gaBootstrapScript(id: string): string {
    const denied = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
    const regional = { ...denied, analytics_storage: "denied", region: CONSENT_DENIED_REGIONS };
    const rest = { ...denied, analytics_storage: "granted" };
    return [
        "window.dataLayer=window.dataLayer||[];",
        "function gtag(){dataLayer.push(arguments);}",
        "window.gtag=gtag;",
        `gtag('consent','default',${JSON.stringify(regional)});`,
        `gtag('consent','default',${JSON.stringify(rest)});`,
        "gtag('js',new Date());",
        `gtag('config',${JSON.stringify(id)});`,
    ].join("\n");
}
