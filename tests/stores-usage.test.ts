import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// /api/stores/usage — the host's per-store image tag is the truth; fleet
// rollouts never report per store, so Tenant.imageTag is reconciled on read.
const { db, getCurrentUser } = vi.hoisted(() => ({
    db: { tenant: { findMany: vi.fn(), update: vi.fn() } },
    getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { GET } from "@/app/api/stores/usage/route";

const ADMIN = { id: "admin-1", role: "admin", email: "a@x.com" };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STORE_PROVISION_URL = "http://127.0.0.1:9098";
    process.env.STORE_PROVISION_SECRET = "s3cret";
    getCurrentUser.mockResolvedValue(ADMIN);
    db.tenant.update.mockImplementation(async ({ where, data }: any) => ({ slug: where.slug, ...data }));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (String(url).endsWith("/usage")) {
            return { ok: true, status: 200, json: async () => ({ stores: { abdo: { image_tag: "1.0.5", db_bytes: 1 }, ahmed: { image_tag: "1.0.5" }, pinned: { image_tag: "1.0.0" } } }) };
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, disk: { free_pct: 40 } }) };
    }));
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.STORE_PROVISION_URL; delete process.env.STORE_PROVISION_SECRET; });

describe("GET /api/stores/usage", () => {
    it("refuses non-admins", async () => {
        getCurrentUser.mockResolvedValue({ id: "u", role: "client" });
        expect((await GET()).status).toBe(403);
    });

    it("updates only the stores whose stored imageTag differs from the host", async () => {
        db.tenant.findMany.mockResolvedValue([
            { slug: "abdo", imageTag: "1.0.0" },
            { slug: "ahmed", imageTag: "1.0.0" },
            { slug: "pinned", imageTag: "1.0.0" },
        ]);
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.synced.sort()).toEqual(["abdo", "ahmed"]);
        expect(db.tenant.update).toHaveBeenCalledTimes(2);
        expect(db.tenant.update).toHaveBeenCalledWith({ where: { slug: "abdo" }, data: { imageTag: "1.0.5" } });
        expect(body.stores.abdo.image_tag).toBe("1.0.5");
    });

    it("writes nothing when the host is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
        const body = await (await GET()).json();
        expect(body.ok).toBe(false);
        expect(body.synced).toEqual([]);
        expect(db.tenant.findMany).not.toHaveBeenCalled();
    });
});
