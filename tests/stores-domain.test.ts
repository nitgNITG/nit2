import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// /api/stores/[slug]/domain — ownership, the DNS gate before certbot, and the
// hand-off to the store provisioner (bind/unbind); /api/stores/update-images.
const { db, getCurrentUser, verifyDnsPointsHere, alertAdmins, notifyTelegram } = vi.hoisted(() => ({
    db: { tenant: { findUnique: vi.fn(), update: vi.fn() } },
    getCurrentUser: vi.fn(),
    verifyDnsPointsHere: vi.fn(),
    alertAdmins: vi.fn(),
    notifyTelegram: vi.fn(),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/customDomain", async (orig) => ({ ...(await orig<any>()), verifyDnsPointsHere }));

import { GET, POST, PUT, DELETE } from "@/app/api/stores/[slug]/domain/route";
import { POST as ROLLOUT } from "@/app/api/stores/update-images/route";

const OWNER = { id: "user-1", role: "client", email: "o@x.com" };
const OTHER = { id: "user-2", role: "client", email: "x@x.com" };
const ADMIN = { id: "admin-1", role: "admin", email: "a@x.com" };
const STORE = { id: "t1", product: "store", slug: "ziad", status: "live", ownerId: "user-1", customDomain: null as string | null, domainStatus: "none", domainError: null as string | null };
const params = { params: { slug: "ziad" } };
const req = (method: string, body?: unknown) => new Request("http://localhost/api/stores/ziad/domain", { method, body: body ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } }) as any;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORE_PROVISION_URL = "http://127.0.0.1:9098";
    process.env.STORE_PROVISION_SECRET = "s3cret";
    getCurrentUser.mockResolvedValue(OWNER);
    db.tenant.findUnique.mockImplementation(async ({ where }: any) => (where.slug === "ziad" ? STORE : null));
    db.tenant.update.mockImplementation(async ({ data }: any) => ({ ...STORE, ...data }));
    fetchMock = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({ ok: true, job: 9 }) }));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.STORE_PROVISION_URL; delete process.env.STORE_PROVISION_SECRET; });

describe("/api/stores/[slug]/domain", () => {
    it("403 for a client who is not the owner", async () => {
        getCurrentUser.mockResolvedValue(OTHER);
        expect((await GET(req("GET"), params)).status).toBe(403);
        expect((await POST(req("POST", { domain: "shop.example.com" }), params)).status).toBe(403);
    });

    it("POST stores a valid domain as pending_dns with store-zone instructions", async () => {
        const res = await POST(req("POST", { domain: "Shop.Example.com" }), params);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(db.tenant.update.mock.calls[0][0].data).toMatchObject({ customDomain: "shop.example.com", domainStatus: "pending_dns" });
        expect(body.subdomain).toBe("ziad.commerce.nitg-eg.com");
        expect(body.instructions.cnameValue).toBe("ziad.commerce.nitg-eg.com");
    });

    it("PUT refuses (409) while DNS does not point here — nothing is queued", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, customDomain: "shop.example.com", domainStatus: "pending_dns" });
        verifyDnsPointsHere.mockResolvedValue({ ok: false, resolved: ["1.2.3.4"], expected: ["9.9.9.9"], detail: "wrong ip" });
        const res = await PUT(req("PUT"), params);
        expect(res.status).toBe(409);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(db.tenant.update.mock.calls[0][0].data.domainError).toBe("wrong ip");
    });

    it("PUT queues bind-domain on the provisioner once DNS is right", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, customDomain: "shop.example.com", domainStatus: "pending_dns" });
        verifyDnsPointsHere.mockResolvedValue({ ok: true, resolved: ["9.9.9.9"], expected: ["9.9.9.9"], detail: "ok" });
        const res = await PUT(req("PUT"), params);
        expect(res.status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:9098/bind-domain/ziad");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ domain: "shop.example.com" });
        expect(db.tenant.update.mock.calls[0][0].data).toMatchObject({ domainStatus: "verifying", googleOauthAdded: false });
    });

    it("DELETE unbinds on the provisioner and clears the row", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...STORE, customDomain: "shop.example.com", domainStatus: "active" });
        const res = await DELETE(req("DELETE"), params);
        expect(res.status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:9098/unbind-domain/ziad");
        expect(db.tenant.update.mock.calls[0][0].data).toMatchObject({ customDomain: null, domainStatus: "none" });
    });
});

describe("POST /api/stores/update-images", () => {
    const roll = (body: unknown) => ROLLOUT(new Request("http://localhost/api/stores/update-images", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }) as any);
    it("admin only, validates the tag, asks the provisioner to roll every store", async () => {
        expect((await roll({ tag: "1.2.0" })).status).toBe(403);
        getCurrentUser.mockResolvedValue(ADMIN);
        expect((await roll({ tag: "bad tag" })).status).toBe(400);
        const res = await roll({ tag: "1.2.0" });
        expect(res.status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:9098/update-image");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tag: "1.2.0" });
    });
});
