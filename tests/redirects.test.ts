import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

// Crawl 2026-11-28 (ClickUp T3): /ar/contact-us and /en/contact-us were 404,
// linked from 12 pages (inside article content) — a dead end on the contact path.

// Resolve a path the way Next's redirects() would, for the `:locale(ar|en)` patterns we use.
async function resolve(path: string): Promise<{ to: string; permanent: boolean | undefined } | null> {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const r of redirects) {
        const re = new RegExp("^" + r.source.replace(":locale(ar|en)", "(?<locale>ar|en)") + "$");
        const m = path.match(re);
        if (m) return { to: r.destination.replace(":locale", m.groups!.locale), permanent: r.permanent };
    }
    return null;
}

describe("redirects", () => {
    it.each(["ar", "en"])("sends the old /%s/contact-us to the real contact page, permanently", async (l) => {
        expect(await resolve(`/${l}/contact-us`)).toEqual({ to: `/${l}/contact`, permanent: true });
    });

    it("keeps the moved service pages redirecting", async () => {
        expect(await resolve("/en/moodle-lms")).toEqual({ to: "/en/our-services/moodle-lms", permanent: true });
    });

    it("does not redirect the real contact page or an unknown locale", async () => {
        expect(await resolve("/ar/contact")).toBeNull();
        expect(await resolve("/fr/contact-us")).toBeNull();
    });
});
