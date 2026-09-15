import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, authAdmin } = vi.hoisted(() => ({
    db: { academyRevenue: { groupBy: vi.fn(), updateMany: vi.fn() } },
    authAdmin: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/predict", () => ({ authAdmin }));

import { POST } from "@/app/api/revenue/settle/route";

function post(body: unknown) {
    return POST(new Request("http://localhost/api/revenue/settle", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    }) as any);
}

beforeEach(() => {
    vi.clearAllMocks();
    authAdmin.mockResolvedValue(true);
    db.academyRevenue.groupBy.mockResolvedValue([{ currency: "EGP", _sum: { amount: 250 }, _count: { _all: 3 } }]);
    db.academyRevenue.updateMany.mockResolvedValue({ count: 3 });
});

describe("POST /api/revenue/settle", () => {
    it("401 when not an admin", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await post({ academySlug: "acme" })).status).toBe(401);
        expect(db.academyRevenue.updateMany).not.toHaveBeenCalled();
    });

    it("400 on an invalid academy slug", async () => {
        expect((await post({ academySlug: "Bad!" })).status).toBe(400);
    });

    it("settle: marks unsettled paid rows settled with a reference and reports the amount", async () => {
        const res = await post({ academySlug: "acme", reference: "bank-tx-99" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ ok: true, action: "settle", count: 3 });
        expect(body.amounts).toEqual([{ currency: "EGP", total: 250, count: 3 }]);

        const upd = db.academyRevenue.updateMany.mock.calls[0][0];
        expect(upd.where).toMatchObject({ academySlug: "acme", status: "paid", settled: false });
        expect(upd.data).toMatchObject({ settled: true, settlementRef: "bank-tx-99" });
        expect(upd.data.settledAt).toBeInstanceOf(Date);
    });

    it("unsettle: reverses (settled=true -> false) and clears the reference", async () => {
        const res = await post({ action: "unsettle", academySlug: "acme" });
        expect(res.status).toBe(200);
        const upd = db.academyRevenue.updateMany.mock.calls[0][0];
        expect(upd.where).toMatchObject({ academySlug: "acme", settled: true });
        expect(upd.data).toEqual({ settled: false, settledAt: null, settlementRef: null });
    });

    it("applies currency, orderIds and upToPaidAt filters", async () => {
        await post({ academySlug: "acme", currency: "usd", orderIds: ["o1", "o2"], upToPaidAt: "2026-09-01T00:00:00Z" });
        const where = db.academyRevenue.updateMany.mock.calls[0][0].where;
        expect(where.currency).toBe("USD");
        expect(where.orderId).toEqual({ in: ["o1", "o2"] });
        expect(where.paidAt.lte).toBeInstanceOf(Date);
    });
});
