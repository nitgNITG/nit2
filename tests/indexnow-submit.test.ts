import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { batches, collectUrls, indexNowPayload, parseArgs, parseSitemap, run } from "../scripts/indexnow-submit.mjs";
import { INDEXNOW_ENDPOINT, INDEXNOW_HOST, INDEXNOW_KEY_LOCATION } from "@/lib/indexNowConfig.mjs";
import { INDEXNOW_KEY } from "@/lib/indexNow";

// scripts/indexnow-submit.mjs — one-off / after-deploy bulk IndexNow submit of every
// URL in the live sitemap. Dry run by default; only --send POSTs. No network here:
// every fetch is a fake.

const SITE = "https://www.nitg-eg.com";
const urlset = (locs: string[]) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs
        .map((l) => `<url>\n<loc>${l}</loc>\n<lastmod>2026-11-28</lastmod>\n</url>`).join("\n")}\n</urlset>`;

type Call = { url: string; method: string; body?: unknown };
function fakeFetch(routes: Record<string, { status?: number; body?: string }>, postStatus: number | number[] = 202) {
    const calls: Call[] = [];
    const statuses = Array.isArray(postStatus) ? [...postStatus] : null;
    const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
        if (method === "POST") return new Response(null, { status: statuses ? statuses.shift() ?? 202 : (postStatus as number) });
        const r = routes[url];
        return r ? new Response(r.body ?? "", { status: r.status ?? 200 }) : new Response("not found", { status: 404 });
    });
    return { fn, calls, posts: () => calls.filter((c) => c.method === "POST") };
}
const quietLog = () => { const lines: string[] = []; return { lines, log: (...a: unknown[]) => lines.push(a.join(" ")) }; };

describe("parseSitemap", () => {
    it("reads every <loc> of a urlset, decoding entities, CDATA and whitespace", () => {
        const xml = urlset([`${SITE}/ar`, ` ${SITE}/en/blog/a?x=1&amp;y=2 `, `<![CDATA[${SITE}/en/contact]]>`]);
        expect(parseSitemap(xml)).toEqual({
            urls: [`${SITE}/ar`, `${SITE}/en/blog/a?x=1&y=2`, `${SITE}/en/contact`],
            sitemaps: [],
        });
    });

    it("returns child sitemaps for a sitemap index", () => {
        const xml = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE}/s1.xml</loc></sitemap><sitemap><loc>${SITE}/s2.xml</loc></sitemap></sitemapindex>`;
        expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: [`${SITE}/s1.xml`, `${SITE}/s2.xml`] });
    });

    it("returns nothing for an empty or non-sitemap document", () => {
        expect(parseSitemap("")).toEqual({ urls: [], sitemaps: [] });
        expect(parseSitemap("<html><body>502 Bad Gateway</body></html>")).toEqual({ urls: [], sitemaps: [] });
    });
});

describe("batches", () => {
    it("splits into batches of at most 10,000 (the IndexNow limit)", () => {
        const urls = Array.from({ length: 25_001 }, (_, i) => `${SITE}/ar/blog/p${i}`);
        expect(batches(urls).map((b: string[]) => b.length)).toEqual([10_000, 10_000, 5_001]);
        expect(batches(urls, 50_000).map((b: string[]) => b.length)).toEqual([10_000, 10_000, 5_001]); // clamped
        expect(batches(urls.slice(0, 5), 2).map((b: string[]) => b.length)).toEqual([2, 2, 1]);
        expect(batches([])).toEqual([]);
    });
});

describe("indexNowPayload", () => {
    it("uses the site's existing key, key file and host", () => {
        expect(indexNowPayload([`${SITE}/ar`])).toEqual({
            host: "www.nitg-eg.com", key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: [`${SITE}/ar`],
        });
        expect(INDEXNOW_KEY_LOCATION).toBe(`https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`);
        expect(INDEXNOW_ENDPOINT).toBe("https://api.indexnow.org/indexnow");
        // the key file the engines fetch to verify ownership is really there, with the key in it
        expect(readFileSync(path.resolve(__dirname, `../public/${INDEXNOW_KEY}.txt`), "utf8").trim()).toBe(INDEXNOW_KEY);
    });
});

describe("parseArgs", () => {
    it("dry-runs by default against the live sitemap", () => {
        expect(parseArgs([])).toMatchObject({ send: false, sitemap: `${SITE}/sitemap.xml`, batchSize: 10_000 });
    });
    it("only sends with --send, and takes an overridden sitemap and batch size", () => {
        expect(parseArgs(["--send", "--sitemap", "https://x.test/sm.xml", "--batch-size=500"]))
            .toMatchObject({ send: true, sitemap: "https://x.test/sm.xml", batchSize: 500 });
        expect(parseArgs(["--send", "--dry-run"]).send).toBe(false); // an explicit dry run wins
        expect(parseArgs(["--sitemap=https://y.test/a.xml"]).sitemap).toBe("https://y.test/a.xml");
    });
});

describe("collectUrls", () => {
    it("follows a sitemap index, dedupes, and keeps only this host's URLs", async () => {
        const { fn } = fakeFetch({
            [`${SITE}/sitemap.xml`]: { body: `<sitemapindex><sitemap><loc>${SITE}/a.xml</loc></sitemap><sitemap><loc>${SITE}/b.xml</loc></sitemap></sitemapindex>` },
            [`${SITE}/a.xml`]: { body: urlset([`${SITE}/ar`, `${SITE}/en`]) },
            [`${SITE}/b.xml`]: { body: urlset([`${SITE}/en`, "https://dev.nitg-eg.com/ar", `${SITE}/ar/blog/x`]) },
        });
        const { urls, skipped } = await collectUrls(`${SITE}/sitemap.xml`, fn);
        expect(urls).toEqual([`${SITE}/ar`, `${SITE}/en`, `${SITE}/ar/blog/x`]);
        expect(skipped).toEqual(["https://dev.nitg-eg.com/ar"]);
    });

    it("fails loudly when the sitemap cannot be fetched", async () => {
        const { fn } = fakeFetch({ [`${SITE}/sitemap.xml`]: { status: 500, body: "oops" } });
        await expect(collectUrls(`${SITE}/sitemap.xml`, fn)).rejects.toThrow(/500/);
    });
});

describe("run", () => {
    const live = { [`${SITE}/sitemap.xml`]: { body: urlset([`${SITE}/ar`, `${SITE}/en`, `${SITE}/ar`, `${SITE}/en/blog/x`]) } };

    it("dry run (the default): prints the count and first URLs, POSTs nothing", async () => {
        const f = fakeFetch(live);
        const { lines, log } = quietLog();
        expect(await run([], { fetch: f.fn, log })).toBe(0);
        expect(f.posts()).toEqual([]);
        const out = lines.join("\n");
        expect(out).toMatch(/3 URLs/);
        expect(out).toContain(`${SITE}/en/blog/x`);
        expect(out).toMatch(/dry run/i);
    });

    it("--send POSTs every URL once, in batches, to IndexNow", async () => {
        const f = fakeFetch(live);
        const { log } = quietLog();
        expect(await run(["--send", "--batch-size=2"], { fetch: f.fn, log })).toBe(0);
        const posts = f.posts();
        expect(posts.map((p) => p.url)).toEqual([INDEXNOW_ENDPOINT, INDEXNOW_ENDPOINT]);
        expect(posts.map((p) => (p.body as { urlList: string[] }).urlList)).toEqual([[`${SITE}/ar`, `${SITE}/en`], [`${SITE}/en/blog/x`]]);
        expect(posts[0].body).toMatchObject({ host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION });
    });

    it("reports failure (exit 1) when IndexNow rejects a batch, but still tries the rest", async () => {
        const f = fakeFetch(live, [422, 202]);
        const { lines, log } = quietLog();
        expect(await run(["--send", "--batch-size=2"], { fetch: f.fn, log })).toBe(1);
        expect(f.posts()).toHaveLength(2);
        expect(lines.join("\n")).toMatch(/422/);
    });

    it("exits 1 without sending when the sitemap is unreachable or empty", async () => {
        const down = fakeFetch({});
        expect(await run(["--send"], { fetch: down.fn, log: quietLog().log })).toBe(1);
        expect(down.posts()).toEqual([]);
        const empty = fakeFetch({ [`${SITE}/sitemap.xml`]: { body: urlset([]) } });
        expect(await run(["--send"], { fetch: empty.fn, log: quietLog().log })).toBe(1);
        expect(empty.posts()).toEqual([]);
    });
});
