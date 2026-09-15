import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, authAdmin } = vi.hoisted(() => ({
    db: {
        academyRevenue: { groupBy: vi.fn(), updateMany: vi.fn() },
        settlement: { create: vi.fn() },
    },
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
    db.settlement.create.mockResolvedValue({ id: "settle-1" });
    db.academyRevenue.updateMany.mockResolvedValue({ count: 3 });
});

describe("POST /api/revenue/settle", () => {
    it("401 when not an admin", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await post({ academySlug: "acme" })).status).toBe(401);
        expect(db.settlement.create).not.toHaveBeenCalled();
    });

    it("400 on an invalid academy slug", async () => {
        expect((await post({ academySlug: "Bad!" })).status).toBe(400);
    });

    it("creates a Settlement per currency and links the outstanding LIVE rows", async () => {
        const res = await post({ academySlug: "acme", method: "instapay", reference: "ipn-9", note: "sept" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ ok: true, count: 3 });
        expect(body.settlements).toEqual([{ id: "settle-1", currency: "EGP", amount: 250, txnCount: 3 }]);

        // Settlement batch captured method/reference/note + amount.
        const sc = db.settlement.create.mock.calls[0][0].data;
        expect(sc).toMatchObject({ academySlug: "acme", currency: "EGP", amount: 250, txnCount: 3, method: "instapay", reference: "ipn-9", note: "sept" });

        // Rows flipped to settled and linked to the settlement; only unsettled LIVE rows.
        const upd = db.academyRevenue.updateMany.mock.calls[0][0];
        expect(upd.where).toMatchObject({ academySlug: "acme", status: "paid", settled: false, mode: "live", currency: "EGP" });
        expect(upd.data).toMatchObject({ settled: true, settlementRef: "ipn-9", settlementId: "settle-1" });
        expect(upd.data.settledAt).toBeInstanceOf(Date);
    });

    it("returns empty when nothing is outstanding (no settlement created)", async () => {
        db.academyRevenue.groupBy.mockResolvedValue([]);
        const res = await post({ academySlug: "acme" });
        expect((await res.json())).toMatchObject({ ok: true, settlements: [], count: 0 });
        expect(db.settlement.create).not.toHaveBeenCalled();
    });

    it("defaults method to bank and applies currency/orderIds/upToPaidAt filters", async () => {
        await post({ academySlug: "acme", currency: "usd", orderIds: ["o1", "o2"], upToPaidAt: "2026-09-01T00:00:00Z" });
        expect(db.settlement.create.mock.calls[0][0].data.method).toBe("bank");
        // Filters are applied on the groupBy query (which drives the per-currency loop).
        const where = db.academyRevenue.groupBy.mock.calls[0][0].where;
        expect(where.currency).toBe("USD");
        expect(where.orderId).toEqual({ in: ["o1", "o2"] });
        expect(where.paidAt.lte).toBeInstanceOf(Date);
    });

    it("settles test revenue only when mode=test is explicit", async () => {
        await post({ academySlug: "acme", mode: "test" });
        expect(db.academyRevenue.updateMany.mock.calls[0][0].where.mode).toBe("test");
    });
});
