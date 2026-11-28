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

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const list = (v?: string | string[]) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// AI-search / AI-assistant crawlers and AI-use tokens the business wants to be cited by,
// plus Bingbot (which also feeds Copilot and ChatGPT search). Each gets its own group.
const NAMED_BOTS = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-SearchBot", "Claude-User",
    "PerplexityBot", "Perplexity-User",
    "Google-Extended", "Applebot-Extended", "Bingbot",
];
// Every crawler the guarantees below must hold for: the catch-all, each named group,
// and one with no group of its own (falls back to "*").
const AGENTS = ["*", ...NAMED_BOTS, "SomeOtherBot"];

const groups = (): Rule[] => {
    const rules = robots().rules;
    return Array.isArray(rules) ? rules : [rules];
};

// RFC 9309 / Google: a crawler obeys ONLY the most specific group naming it (case-insensitive),
// else "*". Within that group the longest matching path prefix wins; on a tie, Allow wins.
function crawlable(urlPath: string, agent = "*"): boolean {
    const all = groups();
    const named = all.find(r => list(r.userAgent).some(ua => ua.toLowerCase() === agent.toLowerCase()));
    const group = named ?? all.find(r => list(r.userAgent).includes("*"))!;
    const match = (patterns: string[]) =>
        Math.max(-1, ...patterns.filter(p => p && urlPath.startsWith(p)).map(p => p.length));
    return match(list(group.allow)) >= match(list(group.disallow));
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

    it.each(AGENTS)("keeps the public site crawlable in both languages — %s", (agent) => {
        for (const p of ["/", "/ar", "/en", "/ar/blog/some-article", "/en/our-services/moodle-lms", "/ar/videos", "/uploads/x.webp", "/llms.txt"]) {
            expect(crawlable(p, agent), p).toBe(true);
        }
    });

    it.each(AGENTS)("blocks the admin dashboard at its real localized paths — %s", (agent) => {
        for (const p of ["/ar/dashboard/", "/en/dashboard/", "/ar/dashboard/blog", "/en/dashboard/contacts"]) {
            expect(crawlable(p, agent), p).toBe(false);
        }
    });

    it.each(AGENTS)("blocks signed-in account and payment pages — %s", (agent) => {
        for (const p of ["/ar/account", "/en/account", "/ar/payment/callback", "/en/payment/callback"]) {
            expect(crawlable(p, agent), p).toBe(false);
        }
    });

    it.each(AGENTS)("blocks private API routes — %s", (agent) => {
        for (const p of ["/api/payments", "/api/me", "/api/academies", "/api/contact", "/api/users"]) {
            expect(crawlable(p, agent), p).toBe(false);
        }
    });

    it.each(AGENTS)("still lets crawlers fetch the public data the pages render from /api — %s", (agent) => {
        for (const p of ["/api/project?type=lms&lang=ar", "/api/sponser", "/api/plans?service=ios", "/api/licenses", "/api/public-settings"]) {
            expect(crawlable(p, agent), p).toBe(true);
        }
    });

    it("gives every AI-search crawler its own group, allowed, repeating exactly the \"*\" rules", () => {
        const star = groups().find(r => list(r.userAgent).includes("*"))!;
        for (const bot of NAMED_BOTS) {
            const own = groups().filter(r => list(r.userAgent).includes(bot));
            expect(own, bot).toHaveLength(1);
            expect(list(own[0].userAgent), bot).toEqual([bot]);
            expect(list(own[0].allow), bot).toEqual(list(star.allow));
            expect(list(own[0].disallow), bot).toEqual(list(star.disallow));
        }
    });

    it("points to the sitemap on the configured domain, falling back to www.nitg-eg.com", () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://staging.example.test";
        expect(robots().sitemap).toBe("https://staging.example.test/sitemap.xml");
        delete process.env.NEXT_PUBLIC_BASE_URL;
        expect(robots().sitemap).toBe("https://www.nitg-eg.com/sitemap.xml");
    });
});
