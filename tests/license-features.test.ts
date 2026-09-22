import { describe, it, expect } from "vitest";
import { FEATURE_TABS, featureDefs, featureKeys, featureLabel } from "@/lib/licenseFeatures";

// The licence editor tabs (Add-ons / Blog / Offers / Ads / Coupons) exist for both
// products and the keys pushed to the apps stay unique and stable.
describe("licence feature catalogue", () => {
    it("has the five tabs, each with toggles for both products", () => {
        expect(FEATURE_TABS.map((t) => t.id)).toEqual(["addons", "blog", "offers", "ads", "coupons"]);
        for (const t of FEATURE_TABS) {
            expect(t.academy.length).toBeGreaterThan(0);
            expect(t.store.length).toBeGreaterThan(0);
        }
    });

    it("keeps the keys the apps already enforce and never duplicates a key", () => {
        expect(featureKeys("academy")).toEqual(expect.arrayContaining(["drm", "coupons", "offers", "subscriptions", "packages", "jitsi"]));
        expect(featureKeys("store")).toEqual(expect.arrayContaining(["blog", "custom_domain", "coupons", "offers"]));
        for (const p of ["academy", "store"] as const) {
            const keys = featureKeys(p);
            expect(new Set(keys).size).toBe(keys.length);
        }
    });

    it("labels fall back to the key for legacy toggles", () => {
        expect(featureLabel("store", "blog", "ar")).toBe("المدونة");
        expect(featureLabel("store", "banners")).toBe("banners");
        expect(featureDefs("store").find((f) => f.key === "blog")?.pending).toBeUndefined();
    });
});
