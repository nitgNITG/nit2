import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";

// ClickUp T4. Audit 2026-11-28: 39 published articles (78 URLs) are only a title and
// an intro paragraph — the daily publisher's sections never arrived (Jul → Oct 2026).
// Until each is completed or removed, keep them out of the index and the sitemap;
// links stay followable. Nothing is deleted.

const { mongo } = vi.hoisted(() => ({ mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import sitemap from "@/app/sitemap";
import { generateMetadata as pageMetadata } from "@/app/[locale]/blog/[articleId]/page";
import { generateMetadata as layoutMetadata } from "@/app/[locale]/blog/[articleId]/layout";
import { isThinArticle } from "@/lib/blog";

const PAST = new Date("2026-08-01T00:00:00Z");

beforeEach(async () => {
    mongo.article = makeModel();
    await mongo.article.create({
        data: { slug: "full", title: "كامل", content: "مقدمة", img: "/a.webp", publishedAt: PAST,
            Section: [{ id: "s1", title: "قسم", content: "نص", list: [] }] },
    });
    await mongo.article.create({ data: { slug: "stub", title: "فاضي", content: "مقدمة فقط", img: "/b.webp", publishedAt: PAST, Section: [] } });
});

describe("isThinArticle", () => {
    it("is true only when the article has no sections", () => {
        expect(isThinArticle({ Section: [] })).toBe(true);
        expect(isThinArticle({ Section: undefined })).toBe(true);
        expect(isThinArticle({ Section: [{ id: "s" }] })).toBe(false);
    });
});

describe("intro-only articles", () => {
    it.each([["page", pageMetadata], ["layout", layoutMetadata]])("%s metadata: noindex, follow", async (_n, generate) => {
        const meta = await generate({ params: { articleId: "stub", locale: "ar" } });
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it.each([["page", pageMetadata], ["layout", layoutMetadata]])("%s metadata: a full article stays indexable", async (_n, generate) => {
        const meta = await generate({ params: { articleId: "full", locale: "en" } });
        expect(meta.robots).toBeUndefined();
    });

    it("are left out of the sitemap; full articles stay in", async () => {
        const urls = (await sitemap()).map((e) => e.url);
        expect(urls.filter((u) => u.endsWith("/blog/full"))).toHaveLength(2);
        expect(urls.some((u) => u.endsWith("/blog/stub"))).toBe(false);
    });
});
