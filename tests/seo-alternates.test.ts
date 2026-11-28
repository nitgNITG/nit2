import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";
import { localeAlternates } from "@/lib/seo/alternates";

// ClickUp T2: pages declared hreflang ar + en but no x-default. And the article
// page's own metadata (which overrides the layout's) built its canonical from the
// URL param, so an article opened by its old id URL declared itself canonical —
// a duplicate of the slug URL.

const { mongo } = vi.hoisted(() => ({ mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import { generateMetadata as articlePageMetadata } from "@/app/[locale]/blog/[articleId]/page";
import { generateMetadata as articleLayoutMetadata } from "@/app/[locale]/blog/[articleId]/layout";

describe("localeAlternates", () => {
    it("gives every page ar, en and an Arabic x-default, with a self canonical", () => {
        expect(localeAlternates("en", "/who-us")).toEqual({
            canonical: "https://www.nitg-eg.com/en/who-us",
            languages: {
                ar: "https://www.nitg-eg.com/ar/who-us",
                en: "https://www.nitg-eg.com/en/who-us",
                "x-default": "https://www.nitg-eg.com/ar/who-us",
            },
        });
    });

    it("handles the home page and a path without a leading slash", () => {
        expect(localeAlternates("ar").canonical).toBe("https://www.nitg-eg.com/ar");
        expect(localeAlternates("ar", "").languages["x-default"]).toBe("https://www.nitg-eg.com/ar");
        expect(localeAlternates("en", "blog").canonical).toBe("https://www.nitg-eg.com/en/blog");
    });
});

describe("every public page uses the shared alternates", () => {
    const root = path.resolve(__dirname, "..");
    const files = (readdirSync(path.join(root, "app/[locale]"), { recursive: true }) as string[])
        .filter((f) => f.endsWith(".tsx") && !f.includes("dashboard"))
        .map((f) => path.join("app/[locale]", f))
        .filter((f) => /alternates\s*:/.test(readFileSync(path.join(root, f), "utf8")));

    it("finds the pages that declare alternates", () => {
        expect(files.length).toBeGreaterThanOrEqual(20);
    });

    it.each(files)("%s builds its alternates with localeAlternates (so it has x-default)", (f) => {
        const src = readFileSync(path.join(root, f), "utf8");
        expect(src).toMatch(/alternates\s*:\s*localeAlternates\(/);
        expect(src).not.toMatch(/languages\s*:\s*\{/);
    });
});

describe("article metadata", () => {
    let id = "";
    beforeEach(async () => {
        mongo.article = makeModel();
        const a = await mongo.article.create({
            data: { slug: "moodle-guide", title: "دليل", titleEn: "Guide", content: "x", img: "/uploads/a.webp", publishedAt: new Date("2026-10-01T00:00:00Z"), Section: [] },
        });
        id = a.id as string;
    });

    it.each([
        ["page", articlePageMetadata],
        ["layout", articleLayoutMetadata],
    ])("%s: an article opened by its old id URL is canonical to its slug URL", async (_name, generate) => {
        const meta = await generate({ params: { articleId: id, locale: "en" } });
        expect(meta.alternates).toEqual(localeAlternates("en", "/blog/moodle-guide"));
    });

    it("an unknown article gets no hreflang links", async () => {
        const meta = await articlePageMetadata({ params: { articleId: "nope", locale: "ar" } });
        expect(meta.alternates).toBeUndefined();
    });
});
