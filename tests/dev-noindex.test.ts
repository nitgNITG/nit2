import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

// Search Console 2026-11-28: dev.nitg-eg.com (the nit2 dev copy) answered `index, follow`
// with robots.txt "Allow: /", so Google crawled it next to the real site. It must say
// noindex — via a header (not a robots.txt Disallow, which would stop Google from ever
// seeing the noindex) — and production hosts must never get it.

type Has = { type: string; value?: string };
type HeaderRule = { source: string; has?: Has[]; missing?: Has[]; headers: { key: string; value: string }[] };

// Next matches a `host` condition as an anchored regex against the hostname (port stripped).
async function robotsHeaderFor(host: string): Promise<string | undefined> {
    const rules = ((await nextConfig.headers?.()) ?? []) as HeaderRule[];
    for (const r of rules) {
        if (r.source !== "/:path*") continue;
        const hostOk = (c: Has) => c.type === "host" && new RegExp(`^${c.value}$`).test(host);
        if (r.has && !r.has.every(hostOk)) continue;
        if (r.missing && r.missing.some(hostOk)) continue;
        const h = r.headers.find((x) => x.key.toLowerCase() === "x-robots-tag");
        if (h) return h.value;
    }
    return undefined;
}

describe("dev site is kept out of search indexes", () => {
    it("sends X-Robots-Tag: noindex, nofollow on every dev.nitg-eg.com page", async () => {
        expect(await robotsHeaderFor("dev.nitg-eg.com")).toBe("noindex, nofollow");
    });

    it.each(["www.nitg-eg.com", "nitg-eg.com", "lae.nitg-eg.com", "dev.nitg-eg.com.evil.test", "xdev.nitg-eg.com", "localhost"])(
        "never sends it for %s",
        async (host) => {
            expect(await robotsHeaderFor(host)).toBeUndefined();
        },
    );
});
