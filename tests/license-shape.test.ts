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
