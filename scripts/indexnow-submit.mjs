#!/usr/bin/env node
// Bulk IndexNow submit: every URL in the live sitemap → Bing, Copilot, Yandex, Seznam,
// Naver … (one engine shares it with the others). Run once after a deploy that adds or
// changes many pages; day-to-day article pings already happen in lib/indexNow.ts.
//
//   node scripts/indexnow-submit.mjs                         # dry run: count + first URLs
//   node scripts/indexnow-submit.mjs --send                  # really submit
//   node scripts/indexnow-submit.mjs --sitemap https://www.nitg-eg.com/sitemap.xml --batch-size=5000
//
// Only URLs on www.nitg-eg.com are sent (IndexNow rejects other hosts for this key).
// Exit code 1 if the sitemap can't be read or any batch is rejected.
import { pathToFileURL } from "node:url";
import { INDEXNOW_ENDPOINT, INDEXNOW_HOST, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "../lib/indexNowConfig.mjs";

export const DEFAULT_SITEMAP = `https://${INDEXNOW_HOST}/sitemap.xml`;
export const MAX_BATCH = 10_000; // IndexNow's per-request limit
const MAX_DEPTH = 3; // sitemap index → sitemap → (no further)

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) =>
    s.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1")
        .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e])
        .trim();

/** The <loc> values of a sitemap: page URLs for a <urlset>, child sitemaps for a <sitemapindex>. */
export function parseSitemap(xml) {
    const locs = Array.from(String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/g), (m) => decode(m[1].trim())).filter(Boolean);
    return /<sitemapindex[\s>]/.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/** Split into requests of at most `size` (clamped to IndexNow's 10,000). */
export function batches(urls, size = MAX_BATCH) {
    const n = Math.max(1, Math.min(MAX_BATCH, Math.floor(size) || MAX_BATCH));
    const out = [];
    for (let i = 0; i < urls.length; i += n) out.push(urls.slice(i, i + n));
    return out;
}

export function indexNowPayload(urlList) {
    return { host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION, urlList };
}

export function parseArgs(argv) {
    const opts = { send: false, dryRun: false, sitemap: DEFAULT_SITEMAP, batchSize: MAX_BATCH };
    for (let i = 0; i < argv.length; i++) {
        const [flag, inline] = argv[i].split(/=(.*)/s, 2);
        const value = () => inline ?? argv[++i];
        if (flag === "--send") opts.send = true;
        else if (flag === "--dry-run") opts.dryRun = true;
        else if (flag === "--sitemap") opts.sitemap = value();
        else if (flag === "--batch-size") opts.batchSize = Number(value());
    }
    if (opts.dryRun) opts.send = false; // an explicit dry run always wins
    return opts;
}

/** All page URLs reachable from the sitemap (following an index), deduped, this host only. */
export async function collectUrls(sitemapUrl, fetchImpl = fetch, depth = 0) {
    const res = await fetchImpl(sitemapUrl, { method: "GET", headers: { Accept: "application/xml" } });
    if (!res.ok) throw new Error(`sitemap ${sitemapUrl} answered ${res.status}`);
    const { urls, sitemaps } = parseSitemap(await res.text());
    const all = [...urls];
    if (depth < MAX_DEPTH) for (const child of sitemaps) all.push(...(await collectUrls(child, fetchImpl, depth + 1)).all);
    const unique = [...new Set(all)];
    const onHost = (u) => { try { return new URL(u).host === INDEXNOW_HOST; } catch { return false; } };
    return { urls: unique.filter(onHost), skipped: unique.filter((u) => !onHost(u)), all: unique };
}

export async function run(argv, { fetch: fetchImpl = fetch, log = console.log } = {}) {
    const opts = parseArgs(argv);
    let urls, skipped;
    try {
        ({ urls, skipped } = await collectUrls(opts.sitemap, fetchImpl));
    } catch (e) {
        log(`✗ could not read the sitemap: ${e instanceof Error ? e.message : e}`);
        return 1;
    }
    const plan = batches(urls, opts.batchSize);
    log(`${urls.length} URLs on ${INDEXNOW_HOST} from ${opts.sitemap} → ${plan.length} batch(es)`);
    if (skipped.length) log(`  skipping ${skipped.length} URL(s) on other hosts, e.g. ${skipped[0]}`);
    if (!urls.length) {
        log("✗ nothing to submit — is the sitemap empty?");
        return 1;
    }
    for (const u of urls.slice(0, 10)) log(`  ${u}`);
    if (urls.length > 10) log(`  … and ${urls.length - 10} more`);

    if (!opts.send) {
        log("Dry run — nothing sent. Re-run with --send to submit to IndexNow.");
        return 0;
    }
    let failed = 0;
    for (const [i, urlList] of plan.entries()) {
        try {
            const res = await fetchImpl(INDEXNOW_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify(indexNowPayload(urlList)),
            });
            // 200 OK / 202 Accepted (key still being verified) are both success.
            if (res.ok) log(`✓ batch ${i + 1}/${plan.length}: ${urlList.length} URLs → ${res.status}`);
            else { failed++; log(`✗ batch ${i + 1}/${plan.length}: IndexNow answered ${res.status}`); }
        } catch (e) {
            failed++;
            log(`✗ batch ${i + 1}/${plan.length}: ${e instanceof Error ? e.message : e}`);
        }
    }
    return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    run(process.argv.slice(2)).then((code) => process.exit(code));
}
