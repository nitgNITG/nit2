// Best-effort IndexNow ping (Bing, Copilot, Yandex, …) so new, edited and deleted blog
// pages get recrawled within minutes instead of waiting for the sitemap. Only the
// production build on www.nitg-eg.com pings — dev/staging must not report their URLs.
// NEVER throws: a failed ping must never break the dashboard action that triggered it.

import { INDEXNOW_ENDPOINT, INDEXNOW_HOST as HOST, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "./indexNowConfig.mjs";

// Key, host and endpoint live in lib/indexNowConfig.mjs, shared with scripts/indexnow-submit.mjs.
export { INDEXNOW_KEY };

/** Both locale URLs of an article, or none while it is still scheduled. */
export function articleUrls(slug: string | null | undefined, publishedAt?: Date | string | null, now: Date = new Date()): string[] {
    if (!slug || (publishedAt && new Date(publishedAt).getTime() > now.getTime())) return [];
    return ["ar", "en"].map((locale) => `https://${HOST}/${locale}/blog/${slug}`);
}

export async function submitToIndexNow(urls: string[]): Promise<void> {
    if (!urls.length || process.env.NODE_ENV !== "production") return;
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${HOST}`;
    if (new URL(base).host !== HOST) return;
    try {
        const res = await fetch(INDEXNOW_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
                host: HOST,
                key: INDEXNOW_KEY,
                keyLocation: INDEXNOW_KEY_LOCATION,
                urlList: urls.filter((url, i) => urls.indexOf(url) === i),
            }),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) console.error("[indexnow] ping rejected", res.status);
    } catch (e) {
        console.error("[indexnow] ping failed", e);
    }
}
