import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { db } = vi.hoisted(() => ({
    db: { tenantRevenue: { upsert: vi.fn() } },
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));

import { POST } from "@/app/api/revenue/ingest/route";

const SECRET = "rev-secret";

function post(body: unknown, secret: string | null = SECRET) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret !== null) headers["x-revenue-secret"] = secret;
    return POST(new Request("http://localhost/api/revenue/ingest", {
        method: "POST",
        body: JSON.stringify(body),
        headers,
    }) as any);
}

const GOOD = {
    tenantSlug: "acme",
    orderId: "PAY-ACME-2026-00012345",
    amount: 250,
    currency: "EGP",
    provider: "kashier",
    kind: "course",
    courseId: 42,
    userRef: "7",
    paidAt: "2026-09-15T10:00:00.000Z",
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUE_INGEST_SECRET = SECRET;
    db.tenantRevenue.upsert.mockResolvedValue({});
});

afterEach(() => {
    delete process.env.REVENUE_INGEST_SECRET;
});

describe("POST /api/revenue/ingest", () => {
    it("500 when the ingest secret is not configured", async () => {
        delete process.env.REVENUE_INGEST_SECRET;
        expect((await post(GOOD)).status).toBe(500);
        expect(db.tenantRevenue.upsert).not.toHaveBeenCalled();
    });

    it("401 when the secret header is missing or wrong", async () => {
        expect((await post(GOOD, null)).status).toBe(401);
        expect((await post(GOOD, "nope")).status).toBe(401);
        expect(db.tenantRevenue.upsert).not.toHaveBeenCalled();
    });

    it("400 on an invalid academy slug", async () => {
        expect((await post({ ...GOOD, tenantSlug: "Bad Slug!" })).status).toBe(400);
    });

    it("400 on a missing order id", async () => {
        expect((await post({ ...GOOD, orderId: "" })).status).toBe(400);
    });

    it("400 on a negative/NaN amount", async () => {
        expect((await post({ ...GOOD, amount: -5 })).status).toBe(400);
        expect((await post({ ...GOOD, amount: "x" })).status).toBe(400);
    });

    it("200 and upserts idempotently on (tenantSlug, orderId)", async () => {
        const res = await post(GOOD);
        expect(res.status).toBe(200);
        expect(db.tenantRevenue.upsert).toHaveBeenCalledTimes(1);
        const arg = db.tenantRevenue.upsert.mock.calls[0][0];
        expect(arg.where).toEqual({ tenantSlug_orderId: { tenantSlug: "acme", orderId: "PAY-ACME-2026-00012345" } });
        expect(arg.create).toMatchObject({ tenantSlug: "acme", amount: 250, currency: "EGP", provider: "kashier", kind: "course", courseId: 42 });
        expect(arg.create.paidAt).toBeInstanceOf(Date);
    });

    it("normalises currency/provider and defaults kind/status", async () => {
        await post({ tenantSlug: "acme", orderId: "o1", amount: 10, currency: "usd", provider: "KASHIER" });
        const arg = db.tenantRevenue.upsert.mock.calls[0][0];
        expect(arg.create).toMatchObject({ currency: "USD", provider: "kashier", kind: "course", status: "paid" });
    });

    it("defaults paidAt to now when omitted", async () => {
        await post({ tenantSlug: "acme", orderId: "o2", amount: 10 });
        const arg = db.tenantRevenue.upsert.mock.calls[0][0];
        expect(arg.create.paidAt).toBeInstanceOf(Date);
    });
});
