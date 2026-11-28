import { describe, it, expect } from "vitest";
import path from "node:path";
import { readFileSync } from "node:fs";
import { loadSeeds, planSeed, validateSeed } from "../scripts/seed-price-ranges.mjs";
import { PriceRangeSchema } from "@/lib/agent/priceRanges";

const FILE = path.join(__dirname, "..", "scripts", "data", "price-ranges.json");
type Seed = { category: string; labelAr: string; labelEn: string; minUsd: number; maxUsd: number | null; notesAr?: string; notesEn?: string };
const seeds: Seed[] = JSON.parse(readFileSync(FILE, "utf8")).ranges;

describe("price-range seed data", () => {
    it("every seed passes the same validation as a save from the dashboard", () => {
        expect(seeds.length).toBeGreaterThan(0);
        for (const s of seeds) {
            const { category, ...body } = s;
            expect({ category, ok: /^[a-z0-9_]{1,60}$/.test(category) }).toEqual({ category, ok: true });
            expect({ category, r: PriceRangeSchema.safeParse({ ...body, active: false }).success }).toEqual({ category, r: true });
        }
        expect(loadSeeds(FILE)).toHaveLength(seeds.length);
    });

    it("covers the categories the assistant's get_price_range tool names", () => {
        const cats = seeds.map((s) => s.category);
        for (const c of ["custom_lms", "lms_mobile_apps", "ecommerce_app", "custom_software"]) expect(cats).toContain(c);
    });

    it("rejects bad rows: category format, max below min, missing label", () => {
        const ok = { category: "x_y", labelAr: "أ", labelEn: "a", minUsd: 100, maxUsd: null };
        expect(validateSeed(ok)).toBeNull();
        expect(validateSeed({ ...ok, category: "Bad Key" })).toMatch(/bad category/);
        expect(validateSeed({ ...ok, maxUsd: 50 })).toMatch(/maxUsd/);
        expect(validateSeed({ ...ok, labelEn: " " })).toMatch(/labelEn/);
        expect(validateSeed({ ...ok, minUsd: -1 })).toMatch(/minUsd/);
        expect(validateSeed({ ...ok, minEgp: 1000, maxEgp: 10 })).toMatch(/maxEgp/);
        expect(validateSeed({ ...ok, maxEgp: 10 })).toMatch(/minEgp before maxEgp/);
        expect(validateSeed({ ...ok, minEgp: 50000, maxEgp: null })).toBeNull();
    });
});

describe("planSeed", () => {
    const two: Seed[] = [
        { category: "custom_lms", labelAr: " منصة ", labelEn: " LMS ", minUsd: 3000, maxUsd: 15000, notesEn: "x" },
        { category: "website", labelAr: "موقع", labelEn: "Website", minUsd: 800, maxUsd: null },
    ];
    const sales = new Map([["custom_lms", { category: "custom_lms", minUsd: 9000, active: true }]]);

    it("by default creates only missing categories, INACTIVE, and never touches a range sales already set", () => {
        const plan = planSeed(two, sales);
        expect(plan.map((p: { action: string; category: string }) => [p.action, p.category])).toEqual([["skip", "custom_lms"], ["create", "website"]]);
        expect(plan[1].data).toEqual({ category: "website", labelAr: "موقع", labelEn: "Website", minUsd: 800, maxUsd: null, minEgp: null, maxEgp: null, notesAr: null, notesEn: null, active: false });
    });

    it("--activate creates them active; --force overwrites existing ones", () => {
        expect(planSeed(two, new Map(), { activate: true }).every((p: { data: { active: boolean } }) => p.data.active)).toBe(true);
        const forced = planSeed(two, sales, { force: true });
        expect(forced[0]).toMatchObject({ action: "update", data: { minUsd: 3000, labelEn: "LMS", active: false } });
    });
});
