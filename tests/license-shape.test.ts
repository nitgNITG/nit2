import { describe, it, expect } from "vitest";
import { parseLicense } from "@/lib/licenseShape";

describe("parseLicense — contactSales", () => {
    it("defaults contactSales to false", () => {
        expect(parseLicense({ name: "Basic" }).contactSales).toBe(false);
    });
    it("is true only for an explicit boolean true", () => {
        expect(parseLicense({ name: "Pro", contactSales: true }).contactSales).toBe(true);
        expect(parseLicense({ name: "Pro", contactSales: "true" }).contactSales).toBe(false);
        expect(parseLicense({ name: "Pro", contactSales: 1 }).contactSales).toBe(false);
    });
});

describe("parseLicense — list prices", () => {
    it("parses list prices, clamped to >= 0, default 0", () => {
        expect(parseLicense({ name: "X" }).listPriceEgp).toBe(0);
        expect(parseLicense({ name: "X", listPriceEgp: 12000, listPriceEgpMonthly: 1200 }))
            .toMatchObject({ listPriceEgp: 12000, listPriceEgpMonthly: 1200 });
        expect(parseLicense({ name: "X", listPriceEgp: -5 }).listPriceEgp).toBe(0);
    });
});

describe("parseLicense — popular", () => {
    it("defaults to false and is true only for boolean true", () => {
        expect(parseLicense({ name: "X" }).popular).toBe(false);
        expect(parseLicense({ name: "X", popular: true }).popular).toBe(true);
        expect(parseLicense({ name: "X", popular: "true" }).popular).toBe(false);
    });
});
