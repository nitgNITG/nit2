import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// /api/stores/[slug] (owner/admin gating + provisioner calls) and the
// provisioner → nit2 progress callback /api/tenants/[slug]/progress.
const { db, getCurrentUser, notifyTelegram, alertAdmins, encryptSecret } = vi.hoisted(() => ({
    db: {
        tenant: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
        license: { findUnique: vi.fn(), findMany: vi.fn() },
        subscription: { updateMany: vi.fn() },
        user: { findUnique: vi.fn() },
    },
    getCurrentUser: vi.fn(),
    notifyTelegram: vi.fn(),
    alertAdmins: vi.fn(),
    encryptSecret: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "" }));
vi.mock("@/lib/secretBox", () => ({ encryptSecret, decryptSecret: (v: string) => v, generateAdminPassword: () => "pw", credentialSecretConfigured: () => true }));
vi.mock("@/lib/serverHealth", () => ({ serverMinFreePct: async () => 20, formatHealth: () => "" }));

import { GET, PATCH, DELETE } from "@/app/api/stores/[slug]/route";
import { POST as PROGRESS } from "@/app/api/tenants/[slug]/progress/route";

const OWNER = { id: "user-1", role: "client", email: "o@x.com" };
const OTHER = { id: "user-2", role: "client", email: "x@x.com" };
const ADMIN = { id: "admin-1", role: "admin", email: "a@x.com" };
const STORE = { id: "t1", product: "store", slug: "ziad", name: "Ziad", status: "live", tier: "store-basic", ownerId: "user-1", adminPasswordEnc: null, nitAdminPasswordEnc: null, validUntil: null, subscribedAt: new Date(), progressJson: null, lastError: null, imageTag: null, licenseMode: null };

const params = { params: { slug: "ziad" } };
const patch = (body: unknown) => PATCH(new Request("http://localhost/api/stores/ziad", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }) as any, params);
const progress = (body: unknown, secret = "wsecret") =>
    PROGRESS(new Request("http://localhost/api/tenants/ziad/progress", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-worker-secret": secret } }) as any, params);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORE_PROVISION_URL = "http://127.0.0.1:9098";
    process.env.STORE_PROVISION_SECRET = "s3cret";
    process.env.WORKER_SECRET = "wsecret";
    db.tenant.findUnique.mockResolvedValue(STORE);
    db.tenant.update.mockImplementation(async ({ data }: any) => ({ ...STORE, ...data }));
    db.tenant.delete.mockResolvedValue(STORE);
    db.subscription.updateMany.mockResolvedValue({ count: 0 });
    encryptSecret.mockImplementation((v: string) => `enc(${v})`);
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STORE_PROVISION_URL; delete process.env.STORE_PROVISION_SECRET; delete process.env.WORKER_SECRET;
});

describe("/api/stores/[slug] — ownership", () => {
    it("GET: owner and admin may read, another client may not, academy rows are not stores", async () => {
        getCurrentUser.mockResolvedValue(OWNER);
        expect((await GET(new Request("http://localhost") as any, params)).status).toBe(200);
        getCurrentUser.mockResolvedValue(ADMIN);
        expect((await GET(new Request("http://localhost") as any, params)).status).toBe(200);
        getCurrentUser.mockResolvedValue(OTHER);
        expect((await GET(new Request("http://localhost") as any, params)).status).toBe(403);
        db.tenant.findUnique.mockResolvedValue({ ...STORE, product: "academy" });
        getCurrentUser.mockResolvedValue(OWNER);
        expect((await GET(new Request("http://localhost") as any, params)).status).toBe(404);
    });

    it("GET never leaks the encrypted passwords", async () => {
        getCurrentUser.mockResolvedValue(OWNER);
        db.tenant.findUnique.mockResolvedValue({ ...STORE, adminPasswordEnc: "SECRET" });
        const body = await (await GET(new Request("http://localhost") as any, params)).json();
        expect(body.store.adminPasswordEnc).toBeUndefined();
        expect(body.store.url).toBe("https://ziad.commerce.nitg-eg.com");
    });

    it("PATCH is admin-only; DELETE is owner-or-admin", async () => {
        getCurrentUser.mockResolvedValue(OWNER);
        expect((await patch({ suspend: true })).status).toBe(403);
        getCurrentUser.mockResolvedValue(OTHER);
        expect((await DELETE(new Request("http://localhost") as any, params)).status).toBe(403);
        expect(db.tenant.delete).not.toHaveBeenCalled();
    });
});

describe("PATCH /api/stores/[slug] (admin)", () => {
    beforeEach(() => getCurrentUser.mockResolvedValue(ADMIN));

    it("suspend: tells the provisioner, then marks the row suspended", async () => {
        const res = await patch({ suspend: true });
        expect(res.status).toBe(200);
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("http://127.0.0.1:9098/suspend/ziad");
        expect(JSON.parse(init.body)).toEqual({ suspended: true });
        expect(db.tenant.update.mock.calls[0][0].data.status).toBe("suspended");
    });

    it("suspend: 502 and no DB change when the provisioner is down", async () => {
        fetchMock.mockImplementation(async () => { throw new Error("ECONNREFUSED"); });
        expect((await patch({ suspend: true })).status).toBe(502);
        expect(db.tenant.update).not.toHaveBeenCalled();
    });

    it("tier: refuses an academy licence, starts a fresh term for a store licence and pushes it", async () => {
        db.license.findUnique.mockResolvedValue({ key: "basic", product: "academy" });
        expect((await patch({ tier: "basic" })).status).toBe(400);

        db.license.findUnique.mockResolvedValue({ key: "store-pro", product: "store", durationDays: 365, name: "Pro", limits: { products: -1 }, features: {} });
        db.license.findMany.mockResolvedValue([]);
        db.tenant.findUnique.mockResolvedValue({ ...STORE, tier: "store-pro" });
        const res = await patch({ tier: "store-pro" });
        expect(res.status).toBe(200);
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data.tier).toBe("store-pro");
        expect(data.validUntil).toBeInstanceOf(Date);
        const push = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/apply-license/ziad"));
        expect(push).toBeTruthy();
        expect(JSON.parse(push![1].body)).toMatchObject({ tier: "store-pro", definition: { limits: { products: -1 } } });
    });

    it("updateImage: 409 while not live, otherwise queues on the provisioner", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, status: "queued" });
        expect((await patch({ updateImage: true, tag: "1.2.0" })).status).toBe(409);
        db.tenant.findUnique.mockResolvedValue(STORE);
        fetchMock.mockResolvedValue({ ok: true, status: 202, json: async () => ({ ok: true, job: 3 }) });
        const res = await patch({ updateImage: true, tag: "1.2.0" });
        expect(res.status).toBe(200);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tag: "1.2.0" });
        expect((await patch({ updateImage: true, tag: "bad tag!" })).status).toBe(400);
    });
});

describe("PATCH issueTls", () => {
    it("asks the provisioner for the certificate and clears the pending note", async () => {
        getCurrentUser.mockResolvedValue(ADMIN);
        db.tenant.findUnique.mockResolvedValue({ ...STORE, lastError: "TLS certificate pending — …" });
        const res = await patch({ issueTls: true });
        expect(res.status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:9098/tls/ziad");
        expect(db.tenant.update.mock.calls[0][0].data.lastError).toBeNull();
    });
    it("502 when certbot fails (DNS still missing)", async () => {
        getCurrentUser.mockResolvedValue(ADMIN);
        fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "certbot failed" }) });
        expect((await patch({ issueTls: true })).status).toBe(502);
        expect(db.tenant.update).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/stores/[slug]", () => {
    it("owner: deprovisions on the provisioner, deletes the row and cancels subscriptions", async () => {
        getCurrentUser.mockResolvedValue(OWNER);
        const res = await DELETE(new Request("http://localhost") as any, params);
        expect(res.status).toBe(200);
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("http://127.0.0.1:9098/deprovision/ziad");
        expect(init.method).toBe("DELETE");
        expect(db.tenant.delete).toHaveBeenCalledWith({ where: { slug: "ziad" } });
        expect(db.subscription.updateMany.mock.calls[0][0].where.tenantSlug).toBe("ziad");
    });
});

describe("POST /api/tenants/[slug]/progress", () => {
    it("401 with a wrong worker secret", async () => {
        expect((await progress({ state: "done" }, "nope")).status).toBe(401);
        expect(db.tenant.update).not.toHaveBeenCalled();
    });

    it("running step → provisioning + progressJson", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, status: "queued" });
        await progress({ product: "store", job: 7, kind: "create", state: "running", step: 6, total: 11, label: "Starting containers" });
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data.status).toBe("provisioning");
        expect(data.progressJson).toMatchObject({ job: 7, step: 6, total: 11, label: "Starting containers" });
    });

    it("done → live, imageTag stored, admins alerted; fallback owner password encrypted", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, status: "provisioning", adminPasswordEnc: null });
        await progress({ job: 7, kind: "create", state: "done", url: "https://ziad.commerce.nitg-eg.com", image_tag: "1.0.0", owner_password: "Generated#1" });
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ status: "live", imageTag: "1.0.0", lastError: null, adminPasswordEnc: "enc(Generated#1)" });
        expect(alertAdmins).toHaveBeenCalled();
    });

    it("done with tls pending → live, but the reason is kept for the admin", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, status: "provisioning" });
        await progress({ job: 7, kind: "create", state: "done", url: "https://ziad.commerce.nitg-eg.com", tls: "pending" });
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data.status).toBe("live");
        expect(String(data.lastError)).toMatch(/TLS certificate pending/);
    });

    it("failed → failed with the reason", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, status: "provisioning" });
        await progress({ job: 7, kind: "create", state: "failed", error: "step failed: Starting containers" });
        expect(db.tenant.update.mock.calls[0][0].data).toMatchObject({ status: "failed", lastError: "step failed: Starting containers" });
    });

    it("ignores an unknown slug (e.g. destroy of an already-deleted row)", async () => {
        db.tenant.findUnique.mockResolvedValue(null);
        const res = await progress({ kind: "destroy", state: "done" });
        expect(res.status).toBe(200);
        expect(db.tenant.update).not.toHaveBeenCalled();
    });
});
