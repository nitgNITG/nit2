import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";

// /llms.txt (llmstxt.org): a plain-Markdown map of the site for AI assistants —
// company summary, service pages in both languages, projects, contact, and the
// newest real articles. Thin (intro-only) and scheduled articles stay out, as in
// the sitemap.

const { mongo } = vi.hoisted(() => ({ mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>> }));
vi.mock("@/prisma/client", () => ({ default: mongo }));

import { GET, revalidate } from "@/app/llms.txt/route";

const SITE = "https://www.nitg-eg.com";
const SERVICES = ["moodle-lms", "ecommerce-app", "delivery-app", "restaurant-app", "loyalty-app", "school-management",
    "educational-platforms", "ai-educational-platforms", "android-app", "ios-app", "website-design"];
const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
const section = [{ id: "s1", title: "قسم", content: "نص", list: [] }];

async function article(n: number, extra: Record<string, unknown> = {}) {
    await mongo.article.create({
        data: { slug: `post-${n}`, title: `مقال ${n}`, titleEn: `Article ${n}`, content: "مقدمة", img: "/a.webp",
            publishedAt: day(n), Section: section, ...extra },
    });
}

const fetchText = async () => {
    const res = await GET();
    return { res, body: await res.text() };
};

beforeEach(() => {
    mongo.article = makeModel();
    delete process.env.NEXT_PUBLIC_BASE_URL;
});

describe("/llms.txt", () => {
    it("is Markdown, rebuilt hourly", async () => {
        const { res } = await fetchText();
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
        expect(revalidate).toBe(3600);
    });

    it("opens with the company name and a one-paragraph summary", async () => {
        const { body } = await fetchText();
        const lines = body.split("\n");
        expect(lines[0]).toBe("# N.I.T Egypt");
        const summary = lines.find((l) => l.startsWith("> "))!;
        for (const word of ["2013", "Moodle", "e-learning", "e-commerce", "delivery", "restaurant", "loyalty", "Egypt", "Gulf", "UK", "Canada"]) {
            expect(summary, word).toContain(word);
        }
    });

    it("links every service page in both languages, plus projects, contact and quote", async () => {
        const { body } = await fetchText();
        for (const s of SERVICES) {
            expect(body, s).toContain(`(${SITE}/en/our-services/${s})`);
            expect(body, s).toContain(`(${SITE}/ar/our-services/${s})`);
        }
        for (const p of ["our-projects", "contact", "get-quote"]) {
            expect(body).toContain(`(${SITE}/en/${p})`);
            expect(body).toContain(`(${SITE}/ar/${p})`);
        }
        expect(body).toMatch(/^## Services$/m);
        expect(body).toMatch(/^## Our Projects$/m);
        expect(body).toMatch(/^## Contact$/m);
    });

    it("lists the 30 newest full articles, newest first, with absolute URLs — never thin or scheduled ones", async () => {
        for (let n = 1; n <= 35; n++) await article(n);
        await article(90, { slug: "thin-one", titleEn: "Thin newest", Section: [] });
        await article(91, { slug: "scheduled-one", titleEn: "Not yet", publishedAt: new Date(Date.now() + 7 * 86400e3) });
        await article(36, { slug: "arabic-only", titleEn: null, title: "مقال عربي فقط" });

        const { body } = await fetchText();
        const links = Array.from(body.matchAll(/^- \[(.+?)\]\((https:\/\/[^)]+\/blog\/[^)]+)\)/gm), (m) => [m[1], m[2]]);
        expect(links).toHaveLength(30);
        expect(links[0]).toEqual(["مقال عربي فقط", `${SITE}/en/blog/arabic-only`]); // titleEn ?? title
        expect(links[1]).toEqual(["Article 35", `${SITE}/en/blog/post-35`]);
        expect(links.at(-1)).toEqual(["Article 7", `${SITE}/en/blog/post-7`]);
        expect(body).not.toContain("thin-one");
        expect(body).not.toContain("scheduled-one");
        expect(body).not.toContain("post-6)");
    });

    it("falls back to the article id when there is no slug, and keeps titles from breaking the Markdown", async () => {
        await mongo.article.create({
            data: { slug: null, title: "x", titleEn: "Moodle [2026] guide", content: "c", img: "/a.webp", publishedAt: day(1), Section: section },
        });
        const { body } = await fetchText();
        const [line] = body.split("\n").filter((l) => l.includes("/blog/"));
        expect(line).toMatch(/^- \[Moodle \\\[2026\\\] guide\]\(https:\/\/www\.nitg-eg\.com\/en\/blog\/[0-9a-f]{24}\)$/);
    });

    it("still serves the static part when the database is down", async () => {
        mongo.article.findMany = vi.fn(async () => { throw new Error("Atlas unreachable"); });
        const { res, body } = await fetchText();
        expect(res.status).toBe(200);
        expect(body).toContain(`(${SITE}/en/our-services/moodle-lms)`);
        expect(body).not.toMatch(/^## Latest articles$/m);
    });

    it("builds URLs on the configured domain", async () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://staging.example.test";
        await article(1);
        const { body } = await fetchText();
        expect(body).toContain("(https://staging.example.test/en/our-services/moodle-lms)");
        expect(body).toContain("(https://staging.example.test/en/blog/post-1)");
        delete process.env.NEXT_PUBLIC_BASE_URL;
    });
});
