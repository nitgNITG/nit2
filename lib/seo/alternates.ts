// One place that builds a page's canonical + hreflang links, so every page
// gets the same set: ar, en, and x-default (Arabic — the site's default
// language, which is also where "/" sends crawlers).

export const SITE_URL = "https://www.nitg-eg.com";
export const DEFAULT_LOCALE = "ar";

/**
 * `path` is the part after the locale, e.g. "who-us" or "/blog/my-slug" ("" = home).
 * Returns Next.js `metadata.alternates`.
 */
export function localeAlternates(locale: string, path = "") {
    const suffix = path === "" || path.startsWith("/") ? path : `/${path}`;
    const url = (l: string) => `${SITE_URL}/${l}${suffix}`;
    return {
        canonical: url(locale),
        languages: {
            ar: url("ar"),
            en: url("en"),
            "x-default": url(DEFAULT_LOCALE),
        },
    };
}
