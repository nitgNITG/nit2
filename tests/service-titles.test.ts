import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Crawl 2026-11-28: /en/our-services/moodle-lms served the Arabic title
// "إنشاء منصة تعليمية | Moodle LMS Development" — the most important English
// commercial page had a title in the wrong language. Every service page must
// give each locale its own title, in that locale's script.

const dir = path.resolve(__dirname, "../app/[locale]/our-services");
const services = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

describe.each(services)("our-services/%s metadata", (service) => {
    const load = async (locale: string) => {
        const mod = await import(path.join(dir, service, "layout.tsx"));
        const meta = await mod.generateMetadata({ params: { locale } });
        return String(meta.title);
    };

    it("has an English title on /en with no Arabic in it", async () => {
        expect(hasArabic(await load("en"))).toBe(false);
    });

    it("has an Arabic title on /ar, different from the English one", async () => {
        const [ar, en] = [await load("ar"), await load("en")];
        expect(hasArabic(ar)).toBe(true);
        expect(ar).not.toBe(en);
    });
});
