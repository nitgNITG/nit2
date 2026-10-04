import { describe, it, expect, beforeEach, vi } from "vitest";

// PUT /api/licenses/<key> — an edited plan must reach the tenants already on it:
// academies through their Moodle, stores through their own PlatformLicense row.
// Without this, toggling a feature changed nothing until the next plan change.
const { db, getCurrentUser, pushStoreLicense, triggerApplyIntegrations } = vi.hoisted(() => ({
    db: { license: { update: vi.fn(), findMany: vi.fn() }, tenant: { findMany: vi.fn() } },
    getCurrentUser: vi.fn(),
    pushStoreLicense: vi.fn(),
    triggerApplyIntegrations: vi.fn(),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/products/store", () => ({ pushStoreLicense }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerApplyIntegrations }));

import { PUT } from "@/app/api/licenses/[key]/route";

const ADMIN = { id: "a1", role: "admin", email: "a@x.com" };
const body = (over: Record<string, unknown> = {}) => ({ name: "Basic", features: { blog: true }, limits: {}, ...over });
const req = (b: unknown) => new Request("http://localhost/api/licenses/store-basic", { method: "PUT", body: JSON.stringify(b), headers: { "content-type": "application/json" } }) as any;

beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(ADMIN);
    db.license.findMany.mockResolvedValue([]);
    db.tenant.findMany.mockResolvedValue([{ slug: "ziad-store" }, { slug: "omar" }]);
    pushStoreLicense.mockResolvedValue({ ok: true, status: 200 });
    process.env.PROVISION_URL = "https://prov.example.com";
    process.env.PROVISION_SECRET = "s";
});

describe("PUT /api/licenses/[key]", () => {
    it("re-pushes an edited STORE plan to every live store on it", async () => {
        db.license.update.mockResolvedValue({ key: "store-basic", product: "store", name: "Basic", features: { blog: true } });
        const res = await PUT(req(body({ product: "store" })), { params: { key: "store-basic" } });
        const data = await res.json();
        expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { tier: "store-basic", product: "store", status: "live" }, select: { slug: true },
        }));
        expect(pushStoreLicense.mock.calls.map((c) => c[0])).toEqual(["ziad-store", "omar"]);
        expect(data.applied).toBe(2);
        expect(data.message).toMatch(/2 stores/);
    });

    it("counts only the stores that actually took it", async () => {
        db.license.update.mockResolvedValue({ key: "store-basic", product: "store", name: "Basic" });
        pushStoreLicense.mockResolvedValueOnce({ ok: false, status: 502, error: "provisioner down" });
        const data = await (await PUT(req(body({ product: "store" })), { params: { key: "store-basic" } })).json();
        expect(data.applied).toBe(1);
    });

    it("leaves the academy path alone", async () => {
        db.license.update.mockResolvedValue({ key: "basic", product: "academy", name: "Basic", videoSource: "vimeo", kashierEnabled: false });
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
        const data = await (await PUT(req(body()), { params: { key: "basic" } })).json();
        expect(pushStoreLicense).not.toHaveBeenCalled();
        expect(triggerApplyIntegrations).toHaveBeenCalledTimes(2);
        expect(data.message).toMatch(/academies/);
        vi.unstubAllGlobals();
    });

    it("refuses non-admins", async () => {
        getCurrentUser.mockResolvedValue({ id: "u", role: "client" });
        expect((await PUT(req(body()), { params: { key: "store-basic" } })).status).toBe(403);
    });
});
