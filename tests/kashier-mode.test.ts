import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { db } = vi.hoisted(() => ({
    db: { platformSetting: { findUnique: vi.fn(), findMany: vi.fn() } },
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
// The credential source: mock the DB integrations loader so these tests exercise the
// ENV fallback path (DB empty). A separate case overrides it to test DB creds.
const { loadIntegrationSecrets } = vi.hoisted(() => ({ loadIntegrationSecrets: vi.fn() }));
vi.mock("@/lib/integrations", () => ({ loadIntegrationSecrets }));

import { resolveCheckout, checkoutConfigured, candidateApiKeys, checkoutMode } from "@/lib/kashier";

const ENV_KEYS = [
    "KASHIER_MODE",
    "KASHIER_MERCHANT_ID", "KASHIER_API_KEY", "KASHIER_SECRET_KEY", "KASHIER_BASE_URL",
    "KASHIER_LIVE_MERCHANT_ID", "KASHIER_LIVE_API_KEY", "KASHIER_LIVE_SECRET_KEY", "KASHIER_LIVE_BASE_URL",
    "KASHIER_TEST_MERCHANT_ID", "KASHIER_TEST_API_KEY", "KASHIER_TEST_SECRET_KEY", "KASHIER_TEST_BASE_URL",
];

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of ENV_KEYS) delete process.env[k];
    db.platformSetting.findUnique.mockResolvedValue(null); // no DB toggle → env fallback
    db.platformSetting.findMany.mockResolvedValue([]);
    loadIntegrationSecrets.mockResolvedValue({}); // no DB creds → env fallback
});
afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
});

describe("kashier checkout mode", () => {
    it("the DB toggle wins over the env default", async () => {
        process.env.KASHIER_MODE = "test";
        db.platformSetting.findUnique.mockResolvedValue({ value: "live" });
        expect(await checkoutMode()).toBe("live");
    });

    it("falls back to KASHIER_MODE env when the DB toggle is unset", async () => {
        process.env.KASHIER_MODE = "live";
        expect(await checkoutMode()).toBe("live");
    });

    it("resolves the mode-specific credential set + base URL", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "live" });
        process.env.KASHIER_LIVE_MERCHANT_ID = "MID-LIVE";
        process.env.KASHIER_LIVE_API_KEY = "live-api";
        process.env.KASHIER_LIVE_SECRET_KEY = "live-secret";
        process.env.KASHIER_TEST_MERCHANT_ID = "MID-TEST";
        const r = await resolveCheckout();
        expect(r).toMatchObject({ mode: "live", merchantId: "MID-LIVE", apiKey: "live-api", secretKey: "live-secret", baseUrl: "https://api.kashier.io" });
    });

    it("defaults the base URL per mode when unset", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "test" });
        process.env.KASHIER_TEST_MERCHANT_ID = "MID-TEST";
        process.env.KASHIER_TEST_API_KEY = "t"; process.env.KASHIER_TEST_SECRET_KEY = "s";
        const r = await resolveCheckout();
        expect(r.baseUrl).toBe("https://test-api.kashier.io");
    });

    it("legacy KASHIER_* is used only for the mode it belongs to (KASHIER_MODE)", async () => {
        process.env.KASHIER_MODE = "test"; // legacy set is the TEST set
        process.env.KASHIER_MERCHANT_ID = "MID-LEGACY";
        process.env.KASHIER_API_KEY = "legacy-api";
        process.env.KASHIER_SECRET_KEY = "legacy-secret";
        db.platformSetting.findUnique.mockResolvedValue({ value: "test" });
        const t = await resolveCheckout();
        expect(t.merchantId).toBe("MID-LEGACY");
        // In live mode the legacy set must NOT leak through.
        db.platformSetting.findUnique.mockResolvedValue({ value: "live" });
        const l = await resolveCheckout();
        expect(l.merchantId).toBe("");
    });

    it("checkoutConfigured reflects which modes have full creds", async () => {
        process.env.KASHIER_LIVE_MERCHANT_ID = "m"; process.env.KASHIER_LIVE_API_KEY = "a"; process.env.KASHIER_LIVE_SECRET_KEY = "s";
        expect(await checkoutConfigured()).toEqual({ live: true, test: false });
    });

    it("candidateApiKeys returns both modes' api keys (deduped, non-empty)", async () => {
        process.env.KASHIER_LIVE_API_KEY = "live-api";
        process.env.KASHIER_TEST_API_KEY = "test-api";
        expect((await candidateApiKeys()).sort()).toEqual(["live-api", "test-api"]);
    });

    it("DB integration creds win over env", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "live" });
        process.env.KASHIER_LIVE_MERCHANT_ID = "MID-ENV";
        loadIntegrationSecrets.mockResolvedValue({
            kashier_merchant_id: "MID-DB", kashier_api_key: "db-api", kashier_secret_key: "db-secret",
            kashier_base_url: "https://db.kashier.io", kashier_fep_url: "https://db-fep.kashier.io",
        });
        const r = await resolveCheckout();
        expect(r).toMatchObject({ mode: "live", merchantId: "MID-DB", apiKey: "db-api", secretKey: "db-secret", baseUrl: "https://db.kashier.io", fepBaseUrl: "https://db-fep.kashier.io" });
    });

    it("FEP base defaults per mode when unset (live=fep, test=test-fep)", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "test" });
        expect((await resolveCheckout()).fepBaseUrl).toBe("https://test-fep.kashier.io");
        db.platformSetting.findUnique.mockResolvedValue({ value: "live" });
        expect((await resolveCheckout()).fepBaseUrl).toBe("https://fep.kashier.io");
    });
});
