import { describe, it, expect } from "vitest";
import { FEATURES, featureKeys, featureLabel } from "@/lib/licenseFeatures";

// One flat list of feature toggles per product. Keys are the contract with the
// products: store-api gates on them (requireFeature) and local_license does the
// same for academies, so a rename here silently turns a paid feature off.
describe("licence feature catalogue", () => {
    it("offers the five plan features for both products", () => {
        for (const p of ["academy", "store"] as const) {
            expect(featureKeys(p).slice(0, 5)).toEqual(["addons", "blog", "offers", "ads", "coupons"]);
        }
    });

    it("keeps the keys each product already enforces", () => {
        expect(featureKeys("academy")).toEqual(expect.arrayContaining(["drm", "coupons", "offers", "subscriptions", "packages", "jitsi"]));
        // store-api: blog, ads, coupons, reports are gated in app.ts today
        expect(featureKeys("store")).toEqual(expect.arrayContaining(["blog", "ads", "coupons", "reports", "custom_domain"]));
    });

    it("never repeats a key within a product", () => {
        for (const p of ["academy", "store"] as const) {
            expect(new Set(featureKeys(p)).size).toBe(featureKeys(p).length);
        }
    });

    it("marks only the toggles the products do not gate on yet", () => {
        const pending = (p: "academy" | "store") => FEATURES[p].filter((f) => f.pending).map((f) => f.key);
        expect(pending("store")).toEqual(["addons", "offers", "reviews"]);
        expect(pending("academy")).toEqual(["addons", "blog", "ads"]);
    });

    it("labels fall back to the key for legacy toggles", () => {
        expect(featureLabel("store", "coupons", "ar")).toBe("كوبونات الخصم");
        expect(featureLabel("store", "banners")).toBe("banners");
    });
});
