import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";

// Live sitemap 2026-11-28: 136 of 186 <loc> URLs carried raw Arabic letters. The
// sitemap protocol wants RFC 3986 URLs (percent-encoded); Google tolerates raw IRIs,
// other consumers (Bing, IndexNow, validators) don't reliably. Slugs that are already
// percent-encoded in the DB must not be encoded twice.

const { mongo } = vi.hoisted(() => ({ mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));

import sitemap from "@/app/sitemap";

const PAST = new Date("2026-08-01T00:00:00Z");
const SECTION = [{ id: "s1", title: "قسم", content: "نص", list: [] }];

beforeEach(async () => {
    mongo.article = makeModel();
    for (const slug of ["تكلفة-منصة-تعليمية", "moodle-cost-2026", "%D8%B3%D9%84%D8%A9-vs-custom"]) {
        await mongo.article.create({ data: { slug, title: "t", content: "c", img: "/a.webp", publishedAt: PAST, Section: SECTION } });
    }
});

describe("sitemap URLs", () => {
    it("are plain ASCII (RFC 3986) — Arabic slugs are percent-encoded", async () => {
        const urls = (await sitemap()).map((e) => e.url);
        for (const u of urls) expect(u, u).toMatch(/^[\x21-\x7e]+$/);
        expect(urls).toContain(`https://www.nitg-eg.com/ar/blog/${encodeURIComponent("تكلفة-منصة-تعليمية")}`);
    });

    it("leaves ASCII slugs alone and never double-encodes an already-encoded slug", async () => {
        const urls = (await sitemap()).map((e) => e.url);
        expect(urls).toContain("https://www.nitg-eg.com/en/blog/moodle-cost-2026");
        expect(urls).toContain("https://www.nitg-eg.com/en/blog/%D8%B3%D9%84%D8%A9-vs-custom");
        expect(urls.some((u) => u.includes("%25"))).toBe(false);
    });
});
