import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { storeProvisionerCall } from "@/lib/products/store";

describe("storeProvisionerCall", () => {
    const env = { ...process.env };
    beforeEach(() => { process.env.STORE_PROVISION_SECRET = "s"; });
    afterEach(() => { process.env = { ...env }; });

    it("reports a missing configuration instead of calling out", async () => {
        delete process.env.STORE_PROVISION_URL;
        const r = await storeProvisionerCall("/images");
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("unreachable");
        expect(r.error).toMatch(/not configured/);
    });

    it("does not throw when STORE_PROVISION_URL has no scheme", async () => {
        process.env.STORE_PROVISION_URL = "saas-store-provision.commerce.nitg-eg.com";
        const r = await storeProvisionerCall("/images");
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error("unreachable");
        expect(r.status).toBe(0);
        expect(r.error).toMatch(/http:\/\/ or https:\/\//);
    });
});
