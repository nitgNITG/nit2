import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// POST /api/stores — the free/comp creation path for the STORE product: the
// shared gates (lib/tenants/gates.ts) in order, the store health gate, then
// createStore() → provisioner /provision → Tenant row (product store, queued).
const { db, getCurrentUser, alertAdmins, notifyTelegram, settingOn, settingInt, mailerConfigured, encryptSecret } = vi.hoisted(() => ({
    db: {
        license: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
        platformSetting: { findUnique: vi.fn() },
        tenant: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
        user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    },
    getCurrentUser: vi.fn(),
    alertAdmins: vi.fn(),
    notifyTelegram: vi.fn(),
    settingOn: vi.fn(),
    settingInt: vi.fn(),
    mailerConfigured: vi.fn(),
    encryptSecret: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "+20100000000" }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/platformSettings", () => ({ settingOn, settingInt, readSetting: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured }));
vi.mock("@/lib/emailOtp", () => ({ createAndSendOtp: vi.fn() }));
vi.mock("@/lib/secretBox", () => ({ encryptSecret, generateAdminPassword: () => "TempPass#123", credentialSecretConfigured: () => true }));
vi.mock("@/lib/serverHealth", () => ({
    serverMinFreePct: async () => 20,
    formatHealth: () => "HEALTH",
    creationBlockedMessage: () => "blocked-please-contact-support",
    healthBlockAlertBody: () => "block-body",
}));

import { POST } from "@/app/api/stores/route";

const USER = { id: "user-1", role: "client", email: "o@x.com", name: "Owner" };
const ADMIN = { id: "admin-1", role: "admin", email: "a@x.com", name: "Admin" };
const FREE = { key: "store-free", product: "store", price: 0, priceEgp: 0, durationDays: 0, name: "Free", limits: { products: 20, staff: 1 }, features: { coupons: false }, contactSales: false, active: true, order: 0 };
const PAID = { ...FREE, key: "store-basic", price: 10, priceEgp: 1500, durationDays: 365, name: "Basic" };

const HEALTHY = { ok: true, status: 200, json: async () => ({ disk: { free_pct: 60 } }) };
const QUEUED = { ok: true, status: 202, json: async () => ({ ok: true, job: 7, status: "queued", slug: "ziad" }) };

function post(body: unknown, ip = "1.2.3.4") {
    return POST(new Request("http://localhost/api/stores", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify(body),
    }) as any);
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORE_PROVISION_URL = "http://127.0.0.1:9098";
    process.env.STORE_PROVISION_SECRET = "s3cret";
    getCurrentUser.mockResolvedValue(USER);
    settingOn.mockResolvedValue(false);      // e-mail verification off
    settingInt.mockResolvedValue(5);         // daily cap
    mailerConfigured.mockReturnValue(false);
    encryptSecret.mockImplementation((v: string) => `enc(${v})`);
    db.license.findFirst.mockResolvedValue(FREE);
    db.license.findMany.mockResolvedValue([{ key: FREE.key, active: true, order: 0, priceEgp: 0 }]);
    db.platformSetting.findUnique.mockResolvedValue(null); // free_store_limit default 1
    db.tenant.count.mockResolvedValue(0);
    db.tenant.findUnique.mockResolvedValue(null);
    db.tenant.create.mockResolvedValue({ id: "t1" });
    fetchMock = vi.fn(async (url: string) => (String(url).endsWith("/health") ? HEALTHY : QUEUED));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STORE_PROVISION_URL;
    delete process.env.STORE_PROVISION_SECRET;
});

describe("POST /api/stores", () => {
    it("401 when not signed in", async () => {
        getCurrentUser.mockResolvedValue(null);
        expect((await post({ name: "Z", slug: "ziad" })).status).toBe(401);
    });

    it("402 for a paid tier without an admin comp (checkout is the only way)", async () => {
        db.license.findFirst.mockResolvedValue(PAID);
        const res = await post({ name: "Z", slug: "ziad", tier: "store-basic" });
        expect(res.status).toBe(402);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("403 when the free-store quota is used up (counts STORE tenants only)", async () => {
        db.tenant.count.mockResolvedValue(1);
        const res = await post({ name: "Z", slug: "ziad" });
        expect(res.status).toBe(403);
        expect(db.tenant.count.mock.calls[0][0].where.product).toBe("store");
    });

    it("400 on a bad slug, 409 on a taken one", async () => {
        expect((await post({ name: "Z", slug: "Bad Slug" })).status).toBe(400);
        db.tenant.findUnique.mockResolvedValue({ id: "other" });
        expect((await post({ name: "Z", slug: "ziad" })).status).toBe(409);
    });

    it("503 + admin alert when the store provisioner is unhealthy — nothing is queued", async () => {
        fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));
        const res = await post({ name: "Z", slug: "ziad" });
        expect(res.status).toBe(503);
        expect(alertAdmins).toHaveBeenCalled();
        expect(db.tenant.create).not.toHaveBeenCalled();
    });

    it("queues the store on the provisioner and records a queued STORE tenant with the encrypted owner password", async () => {
        const res = await post({ name: "Ziad Store", name_ar: "متجر زياد", slug: "ziad", store: { country: "eg", currency: "egp", theme: { primary_color: "#111" } } });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({ ok: true, slug: "ziad", job: 7 });

        const provisionCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/provision"));
        expect(provisionCall).toBeTruthy();
        const sent = JSON.parse(provisionCall![1].body);
        expect(sent.slug).toBe("ziad");
        expect(sent.owner).toMatchObject({ email: "o@x.com", password: "TempPass#123" });
        // NIT support login travels with the bootstrap; its password is stored encrypted in nit2.
        expect(sent.nit_admin).toMatchObject({ email: "support@nitg-eg.com", name: "NIT Support", password: "TempPass#123" });
        expect(sent.store).toMatchObject({ country: "EG", currency: "EGP" });
        expect(sent.license).toMatchObject({ tier: "store-free", definition: { limits: { products: 20, staff: 1, categories: -1, storage_mb: -1 }, features: [] } });
        expect(provisionCall![1].headers["X-Provision-Secret"]).toBe("s3cret");

        const row = db.tenant.create.mock.calls[0][0].data;
        expect(row).toMatchObject({ product: "store", slug: "ziad", status: "queued", tier: "store-free", ownerId: "user-1", branch: null });
        expect(row.adminPasswordEnc).toBe("enc(TempPass#123)");
        expect(row.nitAdminPasswordEnc).toBe("enc(TempPass#123)");
        expect(row.validUntil).toBeNull(); // durationDays 0 = never expires
    });

    it("admin comp: creates for another user on a paid tier with no payment and no quota", async () => {
        getCurrentUser.mockResolvedValue(ADMIN);
        db.user.findUnique.mockResolvedValue({ id: "user-9", email: "m@x.com", name: "Merchant" });
        db.license.findFirst.mockResolvedValue(PAID);
        const res = await post({ name: "Comp", slug: "comp", tier: "store-basic", ownerId: "user-9" });
        expect(res.status).toBe(201);
        expect(db.tenant.count).not.toHaveBeenCalled();
        const row = db.tenant.create.mock.calls[0][0].data;
        expect(row.ownerId).toBe("user-9");
        expect(row.validUntil).toBeInstanceOf(Date);
    });

    it("502 when the provisioner refuses — no tenant row is written", async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).endsWith("/health") ? HEALTHY : { ok: false, status: 500, json: async () => ({ error: "boom" }) });
        const res = await post({ name: "Z", slug: "ziad" });
        expect(res.status).toBe(502);
        expect(db.tenant.create).not.toHaveBeenCalled();
    });
});
