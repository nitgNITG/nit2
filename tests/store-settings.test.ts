import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// lib/storeSettings — the Stores tab of Platform Settings: encrypted secrets,
// legacy storage keys the gates already read, and the push to the store host.
const { db, encryptSecret, decryptSecret, credentialSecretConfigured } = vi.hoisted(() => ({
    db: { platformSetting: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn((a: any) => a) }, $transaction: vi.fn(async (ops: any[]) => ops) },
    encryptSecret: vi.fn((v: string) => `enc(${v})`),
    decryptSecret: vi.fn((v: string) => v.replace(/^enc\((.*)\)$/, "$1")),
    credentialSecretConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/secretBox", () => ({ encryptSecret, decryptSecret, credentialSecretConfigured }));

import { saveStoreSettings, loadStoreSettingsMasked, buildHostConfig, pushStoreSettingsToHost, nitAdminEmail } from "@/lib/storeSettings";

beforeEach(() => {
    vi.clearAllMocks();
    db.platformSetting.findMany.mockResolvedValue([]);
    db.platformSetting.findUnique.mockResolvedValue(null);
    process.env.STORE_PROVISION_URL = "http://127.0.0.1:9098";
    process.env.STORE_PROVISION_SECRET = "s";
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.STORE_PROVISION_URL; delete process.env.STORE_PROVISION_SECRET; });

describe("saveStoreSettings", () => {
    it("encrypts secrets, keeps blank secrets, and writes the legacy keys the gates read", async () => {
        const n = await saveStoreSettings({ free_limit: "2", mail_host: "smtp.gmail.com", mail_pass: "app-pw", cloudinary_api_secret: "" });
        expect(n).toBe(3);
        const keys = db.platformSetting.upsert.mock.calls.map((c) => [c[0].where.key, c[0].create.value]);
        expect(keys).toEqual(expect.arrayContaining([["free_store_limit", "2"], ["store_mail_host", "smtp.gmail.com"], ["store_mail_pass", "enc(app-pw)"]]));
        expect(keys.find((k) => k[0] === "store_cloudinary_api_secret")).toBeUndefined();
    });

    it("refuses to save a secret when CREDENTIAL_SECRET is unset", async () => {
        credentialSecretConfigured.mockReturnValueOnce(false);
        await expect(saveStoreSettings({ mail_pass: "x" })).rejects.toThrow(/CREDENTIAL_SECRET/);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("validates numbers and the auto-update flag", async () => {
        await expect(saveStoreSettings({ daily_ip_limit: "five" })).rejects.toThrow(/whole number/);
        await expect(saveStoreSettings({ auto_update: "yes" })).rejects.toThrow(/1 or 0/);
    });
});

describe("read side", () => {
    it("masks secrets and maps storage keys back to field keys", async () => {
        db.platformSetting.findMany.mockResolvedValue([
            { key: "free_store_limit", value: "3" }, { key: "store_mail_pass", value: "enc(pw)" }, { key: "store_mail_host", value: "smtp" },
        ]);
        const v = await loadStoreSettingsMasked();
        expect(v.free_limit).toEqual({ set: true, value: "3" });
        expect(v.mail_pass).toEqual({ set: true, value: "" });
        expect(v.mail_host).toEqual({ set: true, value: "smtp" });
        expect(v.cloudinary_api_key).toEqual({ set: false, value: "" });
    });

    it("builds the provision.env map from host fields only, skipping blanks", async () => {
        db.platformSetting.findMany.mockResolvedValue([
            { key: "free_store_limit", value: "3" }, { key: "store_mail_pass", value: "enc(pw)" }, { key: "store_mail_host", value: "" }, { key: "store_auto_update", value: "0" },
        ]);
        expect(await buildHostConfig()).toEqual({ MAIL_PASS: "pw", AUTO_UPDATE: "0" });
    });

    it("nitAdminEmail: setting → env → default", async () => {
        expect(await nitAdminEmail()).toBe("support@nitg-eg.com");
        process.env.STORE_NIT_ADMIN_EMAIL = "Ops@NIT.com";
        expect(await nitAdminEmail()).toBe("ops@nit.com");
        db.platformSetting.findUnique.mockResolvedValue({ key: "store_nit_admin_email", value: "Admin@nitg-eg.com" });
        expect(await nitAdminEmail()).toBe("admin@nitg-eg.com");
        delete process.env.STORE_NIT_ADMIN_EMAIL;
    });
});

describe("pushStoreSettingsToHost", () => {
    it("POSTs the host map to /config and relays the host's answer", async () => {
        db.platformSetting.findMany.mockResolvedValue([{ key: "store_mail_host", value: "smtp" }]);
        const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, changed: ["MAIL_HOST"], stores: 4 }) }));
        vi.stubGlobal("fetch", fetchMock);
        const r = await pushStoreSettingsToHost();
        expect(r).toEqual({ ok: true, changed: ["MAIL_HOST"], stores: 4 });
        const [url, init] = fetchMock.mock.calls[0] as any;
        expect(String(url)).toBe("http://127.0.0.1:9098/config");
        expect(JSON.parse(init.body)).toEqual({ values: { MAIL_HOST: "smtp" } });
    });

    it("does nothing when no host value is saved", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const r = await pushStoreSettingsToHost();
        expect(r.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
