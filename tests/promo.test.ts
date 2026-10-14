import { describe, it, expect } from "vitest";
import {
    isoDuration, orderForShowcase, parseFeaturedOrder, parsePromoInput, parseServices, parseShowcaseForm,
    pickFeatured, promoUrls, showcaseState, teaserWindow, toShowcaseProject, videoObjectJsonLd, type StoredProject,
} from "@/lib/promo";

const CLOUD = "nitcloud";
const VIDEO = `https://res.cloudinary.com/${CLOUD}/video/upload/v1729000000/nit-promos/tawreedat.mp4`;

const project = (over: Partial<StoredProject> = {}): StoredProject => ({
    id: "p1", img: "/uploads/projects/1.webp", title: "توريدات جو", titleEn: "Tawreedat Go",
    description: "اطلب من المتاجر القريبة", descriptionEn: "Order from nearby stores", order: 0,
    links: [{ headerEn: "Google Play", headerAr: "جوجل بلاي", link: "https://play.google.com/x" }],
    ...over,
});

describe("promoUrls — teaser/poster/full derived from the one Cloudinary upload", () => {
    it("builds an 8 s muted 720p teaser, a poster frame and the full mp4 under the same version + id", () => {
        const u = promoUrls({ videoUrl: VIDEO, teaserStart: 4, durationSec: 45 })!;
        expect(u.teaserMp4).toBe(`https://res.cloudinary.com/${CLOUD}/video/upload/so_4,eo_12,ac_none,w_1280,h_720,c_limit,br_1m,q_auto:eco,vc_h264/v1729000000/nit-promos/tawreedat.mp4`);
        expect(u.teaserWebm).toMatch(/so_4,eo_12,ac_none.*vc_vp9\/v1729000000\/nit-promos\/tawreedat\.webm$/);
        // poster defaults to one second into the teaser
        expect(u.poster).toBe(`https://res.cloudinary.com/${CLOUD}/video/upload/so_5,w_1280,h_720,c_limit,q_auto/v1729000000/nit-promos/tawreedat.webp`);
        expect(u.full).toBe(`https://res.cloudinary.com/${CLOUD}/video/upload/q_auto,vc_auto/v1729000000/nit-promos/tawreedat.mp4`);
    });

    it("uses an explicit poster frame and ignores transforms already in the stored URL", () => {
        const u = promoUrls({ videoUrl: `https://res.cloudinary.com/${CLOUD}/video/upload/q_auto,f_auto/v1/nit-promos/pos.mov`, posterAt: 20 })!;
        expect(u.poster).toContain("/so_20,w_1280,h_720,c_limit,q_auto/v1/nit-promos/pos.webp");
        expect(u.full).not.toContain("f_auto");
    });

    it("keeps the teaser inside short or late-starting videos", () => {
        expect(teaserWindow({ videoUrl: VIDEO, teaserStart: 40, durationSec: 45 })).toEqual({ start: 37, end: 45 });
        expect(teaserWindow({ videoUrl: VIDEO, teaserStart: 3, durationSec: 6 })).toEqual({ start: 0, end: 6 });
    });

    it("returns null for anything that isn't a Cloudinary video URL", () => {
        expect(promoUrls({ videoUrl: "https://evil.example/video.mp4" })).toBeNull();
        expect(promoUrls({ videoUrl: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/x.jpg` })).toBeNull();
    });
});

describe("isoDuration", () => {
    it("formats seconds as ISO 8601", () => {
        expect(isoDuration(45)).toBe("PT45S");
        expect(isoDuration(75.4)).toBe("PT1M15S");
        expect(isoDuration(120)).toBe("PT2M");
        expect(isoDuration(0)).toBeUndefined();
        expect(isoDuration(null)).toBeUndefined();
    });
});

describe("which layout renders", () => {
    const withPromo = { promo: {} };
    const none = { promo: null };
    it("service section: 2+ → multi, 1 → single, 0 with projects → static, no projects → hidden", () => {
        expect(showcaseState([withPromo, withPromo, none])).toBe("multi");
        expect(showcaseState([none, withPromo])).toBe("single");
        expect(showcaseState([none, none])).toBe("static");
        expect(showcaseState([])).toBe("hidden");
    });

    it("orders projects with a promo first, then by the editorial order", () => {
        const out = orderForShowcase([
            { id: "a", promo: null, order: 0 }, { id: "b", promo: {}, order: 5 }, { id: "c", promo: {}, order: 1 }, { id: "d", promo: null, order: -1 },
        ]);
        expect(out.map((p) => p.id)).toEqual(["c", "b", "d", "a"]);
    });

    it("featured band: only featuredOrder 1–3 that have a promo, sorted, max three", () => {
        const p = (id: string, featuredOrder: number | null, promo = true) => ({ id, featuredOrder, promo: promo ? { videoUrl: VIDEO } : null });
        const out = pickFeatured([p("x", 3), p("y", 1), p("noPromo", 2, false), p("z", null), p("big", 7), p("w", 2)]);
        expect(out.map((r) => r.id)).toEqual(["y", "w", "x"]);
        expect(pickFeatured([p("noPromo", 1, false)])).toEqual([]);
    });
});

describe("toShowcaseProject — localised view", () => {
    it("picks the locale's text and falls back to Arabic when English is missing", () => {
        const p = project({ titleEn: null, categoryEn: "Delivery app · Egypt", categoryAr: "تطبيق توصيل",
            features: [{ en: "Live tracking", ar: "تتبع مباشر" }, { en: "", ar: "" }],
            keyResults: [{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }, { value: " ", labelEn: "x", labelAr: "x" }] });
        const en = toShowcaseProject(p, "en");
        expect(en.title).toBe("توريدات جو");
        expect(en.category).toBe("Delivery app · Egypt");
        expect(en.features).toEqual(["Live tracking"]);
        expect(en.keyResults).toEqual([{ value: "50K+", label: "downloads" }]);
        expect(en.promo).toBeNull();
        const ar = toShowcaseProject(p, "ar");
        expect(ar.category).toBe("تطبيق توصيل");
        expect(ar.links).toEqual([{ label: "جوجل بلاي", href: "https://play.google.com/x" }]);
    });

    it("drops a promo whose URL isn't ours instead of rendering a broken player", () => {
        expect(toShowcaseProject(project({ promo: { videoUrl: "https://x.test/a.mp4" } }), "en").promo).toBeNull();
    });

    it("VideoObject JSON-LD only for projects with a promo", () => {
        const view = toShowcaseProject(project({ promo: { videoUrl: VIDEO, durationSec: 45, uploadDate: "2026-10-01T00:00:00.000Z" } }), "en");
        expect(videoObjectJsonLd(view, "en")).toMatchObject({
            "@type": "VideoObject", name: "Tawreedat Go — promo video", duration: "PT45S",
            uploadDate: "2026-10-01T00:00:00.000Z", contentUrl: view.promo!.full, thumbnailUrl: [view.promo!.poster],
        });
        expect(videoObjectJsonLd(toShowcaseProject(project(), "en"), "en")).toBeNull();
    });
});

describe("dashboard input parsing", () => {
    it("accepts a promo in our Cloudinary account and normalises numbers", () => {
        const r = parsePromoInput(JSON.stringify({ videoUrl: VIDEO, publicId: "nit-promos/tawreedat", durationSec: "45.2", teaserStart: "-3", posterAt: "" }), CLOUD);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({ videoUrl: VIDEO, publicId: "nit-promos/tawreedat", durationSec: 45.2, teaserStart: 0, posterAt: null });
        expect(r.value!.uploadDate).toBeInstanceOf(Date);
    });

    it("rejects video or caption URLs outside our Cloudinary account", () => {
        expect(parsePromoInput(JSON.stringify({ videoUrl: "https://res.cloudinary.com/someoneelse/video/upload/a.mp4" }), CLOUD)).toEqual({ ok: false, error: expect.stringContaining("our Cloudinary") });
        expect(parsePromoInput(JSON.stringify({ videoUrl: "javascript:alert(1)" }), CLOUD).ok).toBe(false);
        expect(parsePromoInput(JSON.stringify({ videoUrl: VIDEO, captionsAr: "https://evil.test/ar.vtt" }), CLOUD).ok).toBe(false);
        expect(parsePromoInput("{not json", CLOUD).ok).toBe(false);
        expect(parsePromoInput(JSON.stringify({ videoUrl: VIDEO }), undefined).ok).toBe(false);
    });

    it("empty promo means remove it", () => {
        expect(parsePromoInput("", CLOUD)).toEqual({ ok: true, value: null });
        expect(parsePromoInput("null", CLOUD)).toEqual({ ok: true, value: null });
    });

    it("featuredOrder is 1–3 or null; services keep known slugs only", () => {
        expect(parseFeaturedOrder("2")).toBe(2);
        expect(parseFeaturedOrder("4")).toBeNull();
        expect(parseFeaturedOrder("1.5")).toBeNull();
        expect(parseFeaturedOrder("")).toBeNull();
        expect(parseServices(JSON.stringify(["ecommerce-app", "hacked", "ecommerce-app", "moodle-lms"]))).toEqual(["ecommerce-app", "moodle-lms"]);
        expect(parseServices("not json")).toEqual([]);
    });

    it("only returns the fields that were sent, so an older client can't wipe them", () => {
        const form = new FormData();
        form.append("categoryEn", "  Delivery app  ");
        const r = parseShowcaseForm(form, CLOUD);
        expect(r).toEqual({ ok: true, data: { categoryEn: "Delivery app" } });
    });

    it("parseShowcaseForm surfaces a bad promo as an error", () => {
        const form = new FormData();
        form.append("promo", JSON.stringify({ videoUrl: "https://x.test/v.mp4" }));
        expect(parseShowcaseForm(form, CLOUD).ok).toBe(false);
    });
});
