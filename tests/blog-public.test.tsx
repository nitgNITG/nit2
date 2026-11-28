import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo } = vi.hoisted(() => ({ mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }));
vi.mock("@/app/[locale]/components/Navbar", () => ({ default: () => null }));
vi.mock("@/app/[locale]/components/Footer", () => ({ default: () => null }));

import ArticlePage from "@/app/[locale]/blog/[articleId]/page";
import sitemap from "@/app/sitemap";

const FUTURE = new Date(Date.now() + 24 * 3600 * 1000);
beforeEach(async () => {
    mongo.article = makeModel();
    await mongo.article.create({
        data: {
            slug: "live", title: "منشور", img: "/uploads/articles/1.webp", publishedAt: new Date("2026-10-01T00:00:00Z"),
            content: "راجع [مقال الشحن](/ar/blog/shipping) أولاً",
            Section: [{ id: "s1", title: "قسم", content: "المصدر: [moodledev](https://moodledev.io)", list: [{ title: "بند", content: "انظر [هنا](/ar/blog/x)" }] }],
        },
    });
    await mongo.article.create({ data: { slug: "soon", title: "مجدول", content: "سر", img: "/uploads/articles/2.webp", publishedAt: FUTURE, Section: [] } });
});

describe("public article page", () => {
    it("renders [label](href) as real links in the intro, section paragraphs and H3 items", async () => {
        const html = renderToStaticMarkup(await ArticlePage({ params: { articleId: "live", locale: "ar" } }));
        expect(html).toContain('<a class="text-[#1E7D67] underline underline-offset-2 hover:opacity-80" href="/ar/blog/shipping">مقال الشحن</a>');
        expect(html).toMatch(/<a href="https:\/\/moodledev.io" target="_blank" rel="noopener noreferrer"[^>]*>moodledev<\/a>/);
        expect(html).toContain('href="/ar/blog/x"');
        expect(html).not.toContain("](");
    });

    it("404s an article before its publish time", async () => {
        await expect(ArticlePage({ params: { articleId: "soon", locale: "ar" } })).rejects.toThrow("NEXT_NOT_FOUND");
    });
});

describe("sitemap", () => {
    it("lists published articles only", async () => {
        const urls = (await sitemap()).map((e) => e.url);
        expect(urls.some((u) => u.endsWith("/blog/live"))).toBe(true);
        expect(urls.some((u) => u.endsWith("/blog/soon"))).toBe(false);
    });
});
