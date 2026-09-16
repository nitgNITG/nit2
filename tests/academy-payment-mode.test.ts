import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, authAdmin, triggerApplyIntegrations } = vi.hoisted(() => ({
    db: {
        academy: { findUnique: vi.fn(), update: vi.fn() },
        license: { findUnique: vi.fn() },
    },
    authAdmin: vi.fn(),
    triggerApplyIntegrations: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/predict", () => ({ authAdmin }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerApplyIntegrations }));

import { GET, PUT } from "@/app/api/academies/[slug]/payment-mode/route";

const ctx = (slug: string) => ({ params: { slug } });
function put(slug: string, body: unknown) {
    return PUT(new Request("http://localhost/x", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) as any, ctx(slug));
}
function get(slug: string) {
    return GET(new Request("http://localhost/x") as any, ctx(slug));
}

beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.mockResolvedValue(true);
    db.academy.findUnique.mockResolvedValue({ tier: "basic", paymentMode: "test" });
    db.academy.update.mockResolvedValue({});
    db.license.findUnique.mockResolvedValue({ videoSource: "all", kashierEnabled: true });
    triggerApplyIntegrations.mockResolvedValue(undefined);
});

describe("academy payment-mode", () => {
    it("GET returns the stored mode (default when null)", async () => {
        expect((await (await get("acme")).json()).mode).toBe("test");
        db.academy.findUnique.mockResolvedValue({ paymentMode: null });
        expect((await (await get("acme")).json()).mode).toBe("default");
    });

    it("GET 401 for non-admin", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await get("acme")).status).toBe(401);
    });

    it("PUT 400 on an invalid mode", async () => {
        expect((await put("acme", { mode: "nope" })).status).toBe(400);
        expect(db.academy.update).not.toHaveBeenCalled();
    });

    it("PUT live: stores 'live' and pushes payment_mode to the academy", async () => {
        const res = await put("acme", { mode: "live" });
        expect(res.status).toBe(200);
        expect(db.academy.update.mock.calls[0][0]).toMatchObject({ where: { slug: "acme" }, data: { paymentMode: "live" } });
        expect(triggerApplyIntegrations).toHaveBeenCalledWith("acme", { videoSource: "all", kashierEnabled: true }, { paymentMode: "live" });
    });

    it("PUT default: stores null (inherit) and pushes the clear", async () => {
        await put("acme", { mode: "default" });
        expect(db.academy.update.mock.calls[0][0].data).toMatchObject({ paymentMode: null });
        expect(triggerApplyIntegrations.mock.calls[0][2]).toEqual({ paymentMode: "default" });
    });

    it("PUT 404 when the academy is missing", async () => {
        db.academy.findUnique.mockResolvedValue(null);
        expect((await put("ghost", { mode: "live" })).status).toBe(404);
    });
});
