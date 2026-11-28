import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";

// ClickUp T1. Live robots.txt was a static public/robots.txt ("Allow: /" only):
// it shadowed app/robots.ts (Next even 500s on /robots.txt in dev with both),
// so private pages were open to crawlers. And app/robots.ts itself blocked
// "/dashboard/" — not a real path (the dashboard is /ar|en/dashboard/) — plus
// all of /api/, which would hide the projects/sponsors/pricing that public pages
// load from /api at render time.

type Rule = { allow?: string | string[]; disallow?: string | string[] };
const list = (v?: string | string[]) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// Google's rule: the longest matching path prefix wins; on a tie, Allow wins.
function crawlable(urlPath: string): boolean {
    const rules = robots().rules;
    const star = (Array.isArray(rules) ? rules : [rules]).find(r => list(r.userAgent).includes("*")) as Rule;
    const match = (patterns: string[]) =>
        Math.max(-1, ...patterns.filter(p => p && urlPath.startsWith(p)).map(p => p.length));
    return match(list(star.allow)) >= match(list(star.disallow));
}

describe("robots.txt", () => {
    const savedBase = process.env.NEXT_PUBLIC_BASE_URL;
    afterEach(() => {
        if (savedBase === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
        else process.env.NEXT_PUBLIC_BASE_URL = savedBase;
    });

    it("is served by app/robots.ts — no static public/robots.txt shadowing it", () => {
        expect(existsSync(path.resolve(__dirname, "../public/robots.txt"))).toBe(false);
    });

    it("keeps the public site crawlable in both languages", () => {
        for (const p of ["/", "/ar", "/en", "/ar/blog/some-article", "/en/our-services/moodle-lms", "/ar/videos", "/uploads/x.webp"]) {
            expect(crawlable(p), p).toBe(true);
        }
    });

    it("blocks the admin dashboard at its real localized paths", () => {
        for (const p of ["/ar/dashboard/", "/en/dashboard/", "/ar/dashboard/blog", "/en/dashboard/contacts"]) {
            expect(crawlable(p), p).toBe(false);
        }
    });

    it("blocks signed-in account and payment pages", () => {
        for (const p of ["/ar/account", "/en/account", "/ar/payment/callback", "/en/payment/callback"]) {
            expect(crawlable(p), p).toBe(false);
        }
    });

    it("blocks private API routes", () => {
        for (const p of ["/api/payments", "/api/me", "/api/academies", "/api/contact", "/api/users"]) {
            expect(crawlable(p), p).toBe(false);
        }
    });

    it("still lets crawlers fetch the public data the pages render from /api", () => {
        for (const p of ["/api/project?type=lms&lang=ar", "/api/sponser", "/api/plans?service=ios", "/api/licenses", "/api/public-settings"]) {
            expect(crawlable(p), p).toBe(true);
        }
    });

    it("points to the sitemap on the configured domain, falling back to www.nitg-eg.com", () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://staging.example.test";
        expect(robots().sitemap).toBe("https://staging.example.test/sitemap.xml");
        delete process.env.NEXT_PUBLIC_BASE_URL;
        expect(robots().sitemap).toBe("https://www.nitg-eg.com/sitemap.xml");
    });
});
