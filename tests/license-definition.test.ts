import { describe, it, expect } from "vitest";
import { toLicenseDefinition, computeUpgradable } from "@/lib/licenseDefinition";

const LIC = {
    name: "Basic", maxCourses: 3, maxTeachers: 1, storageGb: 5, supportedApp: true,
    videoSource: "vimeo", durationDays: 365,
    limits: { quiz: -1, video: -1, pdf: -1, default: -1 },
    features: { coupons: true, subscriptions: false, packages: true },
};

describe("toLicenseDefinition", () => {
    it("emits both expirydate and subscribedat for a timed term", () => {
        const def = JSON.parse(toLicenseDefinition(LIC, {
            validUntil: new Date("2027-07-01T10:00:00Z"),
            subscribedAt: new Date("2026-07-01T10:00:00Z"),
        }));
        expect(def.expirydate).toBe("2027-07-01");
        expect(def.subscribedat).toBe("2026-07-01");
    });

    // The regression this guards: subscribedat must be pushed even when the tier
    // never expires (durationDays 0 → validUntil null). Before the fix it was
    // gated on the term, so free/never-expiring academies reported "subscribed at" null.
    it("still emits subscribedat when there is no expiry", () => {
        const def = JSON.parse(toLicenseDefinition(LIC, {
            validUntil: null,
            subscribedAt: new Date("2026-07-01T10:00:00Z"),
        }));
        expect(def.subscribedat).toBe("2026-07-01");
        expect(def.expirydate).toBeUndefined();
    });

    it("omits both on a plain reapply (no term passed) so existing values are untouched", () => {
        const def = JSON.parse(toLicenseDefinition(LIC));
        expect(def.expirydate).toBeUndefined();
        expect(def.subscribedat).toBeUndefined();
    });

    it("features is the array of ENABLED keys only", () => {
        const def = JSON.parse(toLicenseDefinition(LIC));
        expect(def.features).toEqual(["coupons", "packages"]);
        expect(def.storagegb).toBe(5);
    });
});

describe("computeUpgradable", () => {
    const licenses = [
        { key: "demo", active: true, order: 0, priceEgp: 0 },
        { key: "basic", active: true, order: 1, priceEgp: 5000 },
        { key: "standard", active: true, order: 2, priceEgp: 9000 },
    ];

    it("is true when a higher paid tier exists", () => {
        expect(computeUpgradable("basic", licenses)).toBe(true);
    });

    it("is false for the top tier", () => {
        expect(computeUpgradable("standard", licenses)).toBe(false);
    });

    it("is false for an unknown key", () => {
        expect(computeUpgradable("nope", licenses)).toBe(false);
    });
});
