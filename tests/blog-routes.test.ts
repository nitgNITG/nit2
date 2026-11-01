import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo, authAdmin, revalidatePath, uploadImage, deleteImage } = vi.hoisted(() => ({
    mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>>,
    authAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    uploadImage: vi.fn(async () => "/uploads/articles/new.webp"),
    deleteImage: vi.fn(async () => true),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/predict", () => ({ authAdmin }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/utils/cloudinary", () => ({ uploadImage, deleteImage }));

import { GET as listArticles, POST as createArticle } from "@/app/api/blog/article/route";
import { GET as getArticle, PUT as updateArticle } from "@/app/api/blog/article/[aricleId]/route";
import { GET as listSections, POST as createSection } from "@/app/api/blog/section/route";
import { PUT as updateSection } from "@/app/api/blog/section/[sectionId]/route";

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init) as never;
const form = (fields: Record<string, string | Blob>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
};
const json = (body: unknown, method = "POST") => ({ method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const image = () => new File([new Uint8Array([1, 2, 3])], "cover.jpg", { type: "image/jpeg" });

const PAST = new Date("2026-10-01T08:00:00Z");
const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000);
let live: string, scheduled: string;

beforeEach(async () => {
    mongo.article = makeModel({ unique: [["slug"]], defaults: { publishedAt: () => new Date() } });
    mongo.section = makeModel();
    vi.clearAllMocks();
    authAdmin.mockResolvedValue(true);
    live = (await mongo.article.create({ data: { slug: "live", title: "منشور", content: "مقدمة", img: "/uploads/articles/1.webp", publishedAt: PAST } })).id as string;
    scheduled = (await mongo.article.create({ data: { slug: "soon", title: "مجدول", content: "مقدمة", img: "/uploads/articles/2.webp", publishedAt: FUTURE } })).id as string;
});

describe("GET /api/blog/article", () => {
    it("hides scheduled articles from visitors", async () => {
        authAdmin.mockResolvedValue(false);
        const { articles } = await (await listArticles(req("/api/blog/article"))).json();
        expect(articles.map((a: { slug: string }) => a.slug)).toEqual(["live"]);
    });

    it("pages the list when asked, counting only what the caller may see", async () => {
        const p1 = await (await listArticles(req("/api/blog/article?page=1&pageSize=1"))).json();
        const p2 = await (await listArticles(req("/api/blog/article?page=2&pageSize=1"))).json();
        expect([p1.articles[0].slug, p2.articles[0].slug]).toEqual(["soon", "live"]);
        expect(p2).toMatchObject({ total: 2, page: 2, pageSize: 1, pages: 2 });
        authAdmin.mockResolvedValue(false);
        const visitor = await (await listArticles(req("/api/blog/article?page=1&pageSize=1"))).json();
        expect(visitor).toMatchObject({ total: 1, pages: 1 });
    });

    it("clamps bad paging input and keeps the unpaged response unchanged", async () => {
        expect(await (await listArticles(req("/api/blog/article?page=abc&pageSize=1000"))).json()).toMatchObject({ page: 1, pageSize: 50 });
        expect(await (await listArticles(req("/api/blog/article?page=-3&pageSize=0"))).json()).toMatchObject({ page: 1, pageSize: 12 });
        const all = await (await listArticles(req("/api/blog/article"))).json();
        expect(all).not.toHaveProperty("total");
        expect(all.articles).toHaveLength(2);
    });

    it("shows scheduled articles to the admin dashboard", async () => {
        const { articles } = await (await listArticles(req("/api/blog/article"))).json();
        expect(articles.map((a: { slug: string }) => a.slug).sort()).toEqual(["live", "soon"]);
    });
});

describe("POST /api/blog/article", () => {
    it("refuses non-admins and creates nothing", async () => {
        authAdmin.mockResolvedValue(false);
        const res = await createArticle(req("/api/blog/article", { method: "POST", body: form({ title: "x", content: "y", img: image() }) }));
        expect(res.status).toBe(401);
        expect(mongo.article.rows).toHaveLength(2);
    });

    it("stores a future publish time and the English fields", async () => {
        const when = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
        const res = await createArticle(req("/api/blog/article", {
            method: "POST",
            body: form({ title: "مقال جديد", content: "اقرأ [هذا](/ar/blog/live)", titleEn: "New post", metaDescEn: "Meta", publishedAt: when, img: image() }),
        }));
        expect(res.status).toBe(201);
        const { article } = await res.json();
        expect(article).toMatchObject({ slug: "مقال-جديد", titleEn: "New post", metaDescEn: "Meta", publishedAt: when });
        // The auto meta description is plain text, not link markup.
        expect(article.metaDesc).toBe("اقرأ هذا");
        expect(revalidatePath).toHaveBeenCalledWith("/ar/blog", "page");
    });

    it("rejects an unreadable publish date and missing required fields", async () => {
        const bad = await createArticle(req("/api/blog/article", { method: "POST", body: form({ title: "t", content: "c", img: image(), publishedAt: "soon-ish" }) }));
        expect(bad.status).toBe(400);
        const missing = await createArticle(req("/api/blog/article", { method: "POST", body: form({ title: "  ", content: "c", img: image() }) }));
        expect(missing.status).toBe(400);
        expect(uploadImage).not.toHaveBeenCalled();
    });
});

describe("GET /api/blog/article/[id]", () => {
    it("404s a scheduled article for visitors but returns it to the admin", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await getArticle(req(`/api/blog/article/${scheduled}`), { params: { aricleId: scheduled } })).status).toBe(404);
        authAdmin.mockResolvedValue(true);
        expect((await getArticle(req(`/api/blog/article/${scheduled}`), { params: { aricleId: scheduled } })).status).toBe(200);
    });

    it("returns every field the editor needs, sections in their saved order", async () => {
        await mongo.article.update({ where: { id: live }, data: { titleEn: "Live", contentEn: "EN", metaDesc: "م", metaDescEn: "M" } });
        await mongo.section.create({ data: { articleId: live, title: "ثاني", order: 1, list: [] } });
        await mongo.section.create({ data: { articleId: live, title: "أول", order: 0, list: [] } });
        const { article } = await (await getArticle(req(`/api/blog/article/${live}`), { params: { aricleId: live } })).json();
        expect(Object.keys(article)).toEqual(expect.arrayContaining(["titleEn", "contentEn", "metaDesc", "metaDescEn", "publishedAt", "slug"]));
        expect(article.Section.map((s: { title: string }) => s.title)).toEqual(["أول", "ثاني"]);
    });
});

describe("PUT /api/blog/article/[id]", () => {
    const put = (id: string, fields: Record<string, string | Blob>) =>
        updateArticle(req(`/api/blog/article/${id}`, { method: "PUT", body: form(fields) }), { params: { aricleId: id } });

    it("updates the fields the old edit modal couldn't reach", async () => {
        const when = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
        const res = await put(live, { titleEn: "Live", contentEn: "Intro EN", metaDesc: "ميتا", metaDescEn: "Meta", publishedAt: when });
        expect(res.status).toBe(200);
        expect(mongo.article.rows.find((r) => r.id === live)).toMatchObject({ titleEn: "Live", contentEn: "Intro EN", metaDesc: "ميتا", metaDescEn: "Meta", title: "منشور" });
        expect((mongo.article.rows.find((r) => r.id === live)!.publishedAt as Date).toISOString()).toBe(when);
    });

    it("clears an optional field sent empty, but refuses to clear the title", async () => {
        await put(live, { titleEn: "Live" });
        await put(live, { titleEn: "" });
        expect(mongo.article.rows.find((r) => r.id === live)!.titleEn).toBeNull();
        expect((await put(live, { title: " " })).status).toBe(400);
        expect(mongo.article.rows.find((r) => r.id === live)!.title).toBe("منشور");
    });

    it("409s a slug another article already uses", async () => {
        const res = await put(live, { slug: "soon" });
        expect(res.status).toBe(409);
        expect(mongo.article.rows.find((r) => r.id === live)!.slug).toBe("live");
    });

    it("refuses non-admins without changing anything", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await put(live, { titleEn: "hacked" })).status).toBe(401);
        expect(mongo.article.rows.find((r) => r.id === live)!.titleEn).toBeUndefined();
    });

    it("swaps the cover and deletes the old file only after the upload worked", async () => {
        await put(live, { img: image() });
        expect(deleteImage).toHaveBeenCalledWith("/uploads/articles/1.webp");
        expect(mongo.article.rows.find((r) => r.id === live)!.img).toBe("/uploads/articles/new.webp");
    });
});

describe("sections", () => {
    it("appends a new section after the existing ones when no order is given", async () => {
        await mongo.section.create({ data: { articleId: live, title: "قائم", order: 0, list: [] } });
        const res = await createSection(req("/api/blog/section", json({ articleId: live, title: "جديد", list: [{ title: "بند" }, { title: "" }] })));
        expect(res.status).toBe(201);
        const { section } = await res.json();
        expect(section).toMatchObject({ order: 1, list: [{ title: "بند", titleEn: null, content: null, contentEn: null }] });
    });

    it("refuses non-admins, unknown articles and untitled sections", async () => {
        expect((await createSection(req("/api/blog/section", json({ articleId: "f".repeat(24), title: "x" })))).status).toBe(404);
        expect((await createSection(req("/api/blog/section", json({ articleId: live, title: "" })))).status).toBe(400);
        authAdmin.mockResolvedValue(false);
        expect((await createSection(req("/api/blog/section", json({ articleId: live, title: "x" })))).status).toBe(401);
        expect(mongo.section.rows).toHaveLength(0);
    });

    it("PUT moves a section to a new position", async () => {
        const id = (await mongo.section.create({ data: { articleId: live, title: "قسم", order: 0, list: [] } })).id as string;
        const res = await updateSection(req(`/api/blog/section/${id}`, json({ title: "قسم", order: 3 }, "PUT")), { params: { sectionId: id } });
        expect(res.status).toBe(200);
        expect(mongo.section.rows[0].order).toBe(3);
    });

    it("hides a scheduled article's sections from visitors", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await listSections(req(`/api/blog/section?articleId=${scheduled}`))).status).toBe(404);
        expect((await listSections(req(`/api/blog/section?articleId=${live}`))).status).toBe(200);
    });
});
