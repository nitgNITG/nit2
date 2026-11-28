import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SERVICE_SLUGS, loadEnv, parseArgs, readPromos } from "../scripts/promo-common.mjs";
import { promoFromUpload, slugName, upsertPromo } from "../scripts/promo-upload-video.mjs";
import { planApply, posterUrl, toCreateFields, toFormFields, validateEntry } from "../scripts/promo-apply.mjs";
import { PROMO_SERVICE_SLUGS, parseShowcaseForm } from "@/lib/promo";

const CLOUD = "nitcloud";
const VIDEO = `https://res.cloudinary.com/${CLOUD}/video/upload/v1/nit-promos/tawreedat-go.mp4`;
const live = [
    { id: "p1", titleEn: "Tawreedat Go", title: "توريدات جو", important: true, promo: null },
    { id: "p2", titleEn: "Buzz", title: "باز", important: false, promo: { videoUrl: VIDEO } },
];

describe("promo scripts stay in sync with the app", () => {
    it("knows the same service slugs as lib/promo.ts", () => {
        expect([...SERVICE_SLUGS].sort()).toEqual([...PROMO_SERVICE_SLUGS].sort());
    });

    it("the shipped scripts/data/promos.json is valid", () => {
        const { projects } = readPromos();
        expect(projects.length).toBeGreaterThan(0);
        expect(projects.flatMap(validateEntry)).toEqual([]);
    });

    it("what promo-apply sends is parsed by the API exactly as intended", () => {
        const entry = {
            match: "Tawreedat Go", services: ["delivery-app"], featuredOrder: 2, categoryEn: "Supplies", categoryAr: "توريدات",
            features: [{ en: "Orders", ar: "طلبات" }], keyResults: [{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }],
            promo: promoFromUpload({ secure_url: VIDEO, public_id: "nit-promos/tawreedat-go", duration: 44.37, created_at: "2026-10-14T10:00:00Z" }, { teaserStart: 3 }),
        };
        const form = new FormData();
        for (const [k, v] of Object.entries(toFormFields(entry, live[0]))) form.append(k, v);
        const parsed = parseShowcaseForm(form, CLOUD);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.data).toMatchObject({
            services: ["delivery-app"], featuredOrder: 2, categoryEn: "Supplies", categoryAr: "توريدات",
            features: [{ en: "Orders", ar: "طلبات" }], keyResults: [{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }],
            promo: { videoUrl: VIDEO, publicId: "nit-promos/tawreedat-go", durationSec: 44.4, teaserStart: 3, posterAt: null },
        });
        expect(form.get("important")).toBe("true"); // the PUT route resets it when missing
    });
});

describe("promo-upload-video", () => {
    it("makes Cloudinary-safe names", () => {
        expect(slugName("Tawreedat Go")).toBe("tawreedat-go");
        expect(slugName("POS Promo FINAL (v2).mp4")).toBe("pos-promo-final-v2");
    });

    it("records the upload on the project's entry, keeping its other fields", () => {
        const data = { _help: "x", projects: [{ match: "tawreedat go", services: ["ecommerce-app"] }] };
        const promo = { videoUrl: VIDEO };
        const out = upsertPromo(data, "Tawreedat Go", promo);
        expect(out.projects).toEqual([{ match: "tawreedat go", services: ["ecommerce-app"], promo }]);
        expect(out._help).toBe("x");
        expect(upsertPromo(data, "POS", promo).projects.at(-1)).toEqual({ match: "POS", promo });
        expect(data.projects[0]).not.toHaveProperty("promo"); // input not mutated
    });
});

describe("promo-apply", () => {
    it("rejects typos before touching the site", () => {
        expect(validateEntry({ match: "Buzz", services: ["ecommerce"] })[0]).toMatch(/unknown service "ecommerce"/);
        expect(validateEntry({ match: "Buzz", featuredOrder: 4 })[0]).toMatch(/featuredOrder/);
        expect(validateEntry({ match: "Buzz", promo: { videoUrl: "https://drive.google.com/x" } })[0]).toMatch(/Cloudinary/);
        expect(validateEntry({ match: "Buzz", servces: [] })[0]).toMatch(/unknown key "servces"/);
        expect(validateEntry({ services: [] })[0]).toMatch(/"match"/);
        expect(validateEntry({ match: "Buzz", promo: null })).toEqual([]);
    });

    it("only sends the keys an entry has; promo null means remove", () => {
        expect(toFormFields({ match: "Buzz", services: [] }, live[1])).toEqual({ important: "false", services: "[]" });
        expect(toFormFields({ match: "Buzz", promo: null, featuredOrder: null }, live[1])).toEqual({ important: "false", promo: "", featuredOrder: "" });
    });

    it("matches by English title, Arabic title or id; reports missing projects; --only filters", () => {
        const entries = [{ match: "tawreedat go", services: [] }, { match: "باز", services: [] }, { match: "POS", services: [] }];
        const plan = planApply(entries, live);
        expect(plan.steps.map((s) => s.project.id)).toEqual(["p1", "p2"]);
        expect(plan.missing).toEqual(["POS"]);
        expect(planApply(entries, live, { only: "Tawreedat Go" }).steps).toHaveLength(1);
    });

    it("warns about a shared featured position and a featured project with no video", () => {
        const { warnings } = planApply([{ match: "Tawreedat Go", featuredOrder: 1 }, { match: "Buzz", featuredOrder: 1 }], live);
        expect(warnings).toEqual([
            '"Tawreedat Go" is featured but has no promo video — it won\'t show in the band until it has one',
            'featuredOrder 1 is used by both "Tawreedat Go" and "Buzz"',
        ]);
    });
});

describe("promo-apply — creating a missing project", () => {
    const promo = { videoUrl: `https://res.cloudinary.com/${CLOUD}/video/upload/v9/nit-promos/pos.mp4`, teaserStart: 6, posterAt: 3 };
    const entry = {
        match: "Eerad POS", promo, services: ["restaurant-app"], featuredOrder: 2,
        create: { titleEn: "Eerad POS", title: "إيراد POS", descriptionEn: " One cashier system ", description: "نظام كاشير", image: "poster" },
    };

    it("plans a create (not 'missing') when the entry has a create block", () => {
        const plan = planApply([entry], live);
        expect(plan.missing).toEqual([]);
        expect(plan.steps).toHaveLength(1);
        expect(plan.steps[0].action).toBe("create");
        expect(plan.steps[0].fields).toMatchObject({ titleEn: "Eerad POS", descriptionEn: "One cashier system", types: '["ecommerce"]', links: "[]", important: "false" });
    });

    it("once the project exists, the same entry updates it instead of creating a duplicate", () => {
        const plan = planApply([entry], [...live, { id: "p9", titleEn: "Eerad POS", important: false }]);
        expect(plan.steps.map((s) => [s.action, s.project.id])).toEqual([["update", "p9"]]);
    });

    it("the create fields carry the showcase data the API stores", () => {
        const form = new FormData();
        for (const [k, v] of Object.entries(toCreateFields(entry))) form.append(k, v);
        const parsed = parseShowcaseForm(form, CLOUD);
        expect(parsed.ok && parsed.data).toMatchObject({ services: ["restaurant-app"], featuredOrder: 2, promo: { videoUrl: promo.videoUrl, posterAt: 3 } });
    });

    it("uses the promo's poster frame as the card image", () => {
        expect(posterUrl(promo)).toBe(`https://res.cloudinary.com/${CLOUD}/video/upload/so_3,w_1280,h_720,c_limit,q_auto/v9/nit-promos/pos.jpg`);
        expect(posterUrl({ ...promo, posterAt: null })).toContain("/so_7,");
    });

    it("rejects an incomplete create block", () => {
        expect(validateEntry({ match: "X", create: { titleEn: "X", image: "a.png" } }).join(" ")).toMatch(/create\.title is required/);
        expect(validateEntry({ match: "X", create: { ...entry.create } }).join(" ")).toMatch(/"poster" needs a promo video/);
        expect(validateEntry(entry)).toEqual([]);
    });
});

describe("helpers", () => {
    it("parses flags", () => {
        expect(parseArgs(["a.mp4", "--project", "Tawreedat Go", "--teaser-start=4", "--no-save"], ["no-save"]))
            .toEqual({ _: ["a.mp4"], project: "Tawreedat Go", "teaser-start": "4", "no-save": true });
    });

    it("loads .env like the app (quotes, \\$ escapes) without overriding the environment", () => {
        const dir = mkdtempSync(path.join(os.tmpdir(), "promo-env-"));
        const file = path.join(dir, ".env");
        writeFileSync(file, 'PROMO_T_A="x\\$y"\nPROMO_T_B=plain # comment\nPROMO_T_C=keep\n');
        process.env.PROMO_T_C = "already";
        loadEnv(file);
        expect([process.env.PROMO_T_A, process.env.PROMO_T_B, process.env.PROMO_T_C]).toEqual(["x$y", "plain", "already"]);
        for (const k of ["PROMO_T_A", "PROMO_T_B", "PROMO_T_C"]) delete process.env[k];
    });
});
