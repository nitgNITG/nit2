import { describe, it, expect } from "vitest";
import { isScheduled, parsePublishedAt, parseRichText, publishedWhere, stripRichText } from "@/lib/blog";
import { toSectionData } from "@/lib/blogSection";

describe("parseRichText — links inside article text", () => {
    it("turns [label](/path) into an internal link and keeps the text around it", () => {
        expect(parseRichText("راجع [مقال الشحن](/ar/blog/shipping) قبل التعاقد")).toEqual([
            { type: "text", value: "راجع " },
            { type: "link", label: "مقال الشحن", href: "/ar/blog/shipping", external: false },
            { type: "text", value: " قبل التعاقد" },
        ]);
    });

    it("marks http(s) links as external", () => {
        expect(parseRichText("[docs](https://moodledev.io/general/releases)")).toEqual([
            { type: "link", label: "docs", href: "https://moodledev.io/general/releases", external: true },
        ]);
    });

    it("leaves unsafe or malformed links as plain text", () => {
        for (const raw of ["[x](javascript:alert(1))", "[x](//evil.com)", "[x](mailto:a@b.c)", "[open bracket(/ar/blog)", "[x]( /ar)"]) {
            const tokens = parseRichText(raw);
            expect(tokens.some((t) => t.type === "link")).toBe(false);
            expect(tokens.map((t) => (t.type === "text" ? t.value : "")).join("")).toBe(raw);
        }
    });

    it("turns new lines into breaks and handles empty input", () => {
        expect(parseRichText("a\nb")).toEqual([{ type: "text", value: "a" }, { type: "break" }, { type: "text", value: "b" }]);
        expect(parseRichText("")).toEqual([]);
        expect(parseRichText(null)).toEqual([]);
    });

    it("stripRichText keeps link labels for excerpts and meta descriptions", () => {
        expect(stripRichText("اقرأ [دليل التكلفة](/ar/blog/cost)\nثم قرر")).toBe("اقرأ دليل التكلفة ثم قرر");
    });
});

describe("scheduling helpers", () => {
    const now = new Date("2026-11-01T10:00:00Z");

    it("publishedWhere only lets through articles whose time has come", () => {
        expect(publishedWhere(now)).toEqual({ publishedAt: { lte: now } });
    });

    it("isScheduled is true only for a future publish time", () => {
        expect(isScheduled("2026-11-01T10:00:01Z", now)).toBe(true);
        expect(isScheduled("2026-11-01T10:00:00Z", now)).toBe(false);
        expect(isScheduled(null, now)).toBe(false);
    });

    it("parsePublishedAt: missing → undefined, garbage → null, ISO → Date", () => {
        expect(parsePublishedAt(null)).toBeUndefined();
        expect(parsePublishedAt("")).toBeUndefined();
        expect(parsePublishedAt("next tuesday")).toBeNull();
        expect(parsePublishedAt("2026-12-01T08:00:00.000Z")?.toISOString()).toBe("2026-12-01T08:00:00.000Z");
    });
});

describe("toSectionData", () => {
    it("requires an Arabic H2 title, trims fields and drops untitled H3 items", () => {
        expect(toSectionData({ title: "  " })).toBeNull();
        expect(toSectionData({ title: " عنوان ", titleEn: "", content: " فقرة ", list: [{ title: "بند" }, { title: "", content: "orphan" }] })).toEqual({
            title: "عنوان", titleEn: null, content: "فقرة", contentEn: null,
            list: [{ title: "بند", titleEn: null, content: null, contentEn: null }],
        });
    });
});
