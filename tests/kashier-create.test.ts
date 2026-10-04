import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, getCurrentUser, kashierConfigured, createSession, subscriptionsEnabled, sanitizeBrand } = vi.hoisted(() => ({
    db: {
        tenant: { findUnique: vi.fn() },
        license: { findUnique: vi.fn(), findFirst: vi.fn() },
        subscription: { findUnique: vi.fn() },
        payment: { create: vi.fn(), update: vi.fn() },
    },
    getCurrentUser: vi.fn(),
    kashierConfigured: vi.fn(),
    createSession: vi.fn(),
    subscriptionsEnabled: vi.fn(),
    sanitizeBrand: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/kashier", () => ({ kashierConfigured, createSession }));
vi.mock("@/lib/subscriptions", () => ({ subscriptionsEnabled }));
vi.mock("@/lib/brand", () => ({ sanitizeBrand }));

import { POST } from "@/app/api/payments/kashier/create/route";

const USER = { id: "user-1", role: "client", email: "o@x.com", name: "Owner" };

function post(body: unknown) {
    const req = new Request("http://localhost/api/payments/kashier/create", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
    return POST(req as any);
}

beforeEach(() => {
    vi.clearAllMocks();
    kashierConfigured.mockReturnValue(true);
    subscriptionsEnabled.mockReturnValue(true);
    sanitizeBrand.mockImplementation((b: unknown) => b ?? {});
    getCurrentUser.mockResolvedValue(USER);
    db.tenant.findUnique.mockResolvedValue(null);
    db.license.findUnique.mockResolvedValue(null);
    db.license.findFirst.mockResolvedValue(null);
    db.subscription.findUnique.mockResolvedValue(null);
    db.payment.create.mockResolvedValue({});
    db.payment.update.mockResolvedValue({});
    createSession.mockResolvedValue({ ok: true, sessionId: "sess_1", sessionUrl: "https://pay/checkout" });
});

describe("POST /api/payments/kashier/create", () => {
    it("503 when Kashier isn't configured", async () => {
        kashierConfigured.mockReturnValue(false);
        expect((await post({ purpose: "new_academy" })).status).toBe(503);
    });

    it("401 when not signed in", async () => {
        getCurrentUser.mockResolvedValue(null);
        expect((await post({ purpose: "new_academy" })).status).toBe(401);
    });

    describe("new_academy", () => {
        const PAID = { key: "basic", priceEgp: 5000, priceEgpMonthly: 500, durationDays: 365 };

        it("records a pending payment with the create payload and returns the checkout URL", async () => {
            db.license.findFirst.mockResolvedValue(PAID);
            const res = await post({ purpose: "new_academy", tier: "basic", name: "Acme", slug: "acme" });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toMatchObject({ ok: true, url: "https://pay/checkout" });

            const data = db.payment.create.mock.calls[0][0].data;
            expect(data).toMatchObject({
                licenseKey: "basic", purpose: "new_academy", amount: 5000,
                currency: "EGP", status: "pending", tenantSlug: "acme",
            });
            expect(data.payloadJson).toMatchObject({
                slug: "acme", tier: "basic", owner_email: "o@x.com",
                autoRenew: false, cycle: "annual", cycleDays: 365,
            });
        });

        it("saves the card when the buyer opts into auto-renew", async () => {
            db.license.findFirst.mockResolvedValue(PAID);
            await post({ purpose: "new_academy", tier: "basic", name: "Acme", slug: "acme", autoRenew: true });
            expect(db.payment.create.mock.calls[0][0].data.payloadJson.autoRenew).toBe(true);
            expect(createSession.mock.calls[0][0].saveCard).toBe(true);
        });

        it("400 for a free tier (no price) — should be created directly, not paid", async () => {
            db.license.findFirst.mockResolvedValue({ key: "demo", priceEgp: 0, durationDays: 14 });
            const res = await post({ purpose: "new_academy", tier: "demo", name: "D", slug: "demo1" });
            expect(res.status).toBe(400);
            expect(db.payment.create).not.toHaveBeenCalled();
        });

        it("400 for a monthly cycle when the tier has no monthly price", async () => {
            db.license.findFirst.mockResolvedValue({ key: "basic", priceEgp: 5000, priceEgpMonthly: 0, durationDays: 365 });
            const res = await post({ purpose: "new_academy", tier: "basic", name: "A", slug: "acme", cycle: "monthly" });
            expect(res.status).toBe(400);
        });

        it("400 (contact_sales) for a contact-sales plan — no payment taken", async () => {
            db.license.findFirst.mockResolvedValue({ key: "pro", priceEgp: 9000, durationDays: 365, contactSales: true });
            const res = await post({ purpose: "new_academy", tier: "pro", name: "A", slug: "acme" });
            expect(res.status).toBe(400);
            expect((await res.json()).errorcode).toBe("contact_sales");
            expect(db.payment.create).not.toHaveBeenCalled();
        });

        it("409 when the slug is already taken", async () => {
            db.license.findFirst.mockResolvedValue(PAID);
            db.tenant.findUnique.mockResolvedValue({ slug: "acme" });
            expect((await post({ purpose: "new_academy", tier: "basic", name: "A", slug: "acme" })).status).toBe(409);
        });

        it("400 on an invalid slug", async () => {
            db.license.findFirst.mockResolvedValue(PAID);
            expect((await post({ purpose: "new_academy", tier: "basic", name: "A", slug: "Bad Slug" })).status).toBe(400);
        });

        it("502 and marks the payment failed when Kashier session creation fails", async () => {
            db.license.findFirst.mockResolvedValue(PAID);
            createSession.mockResolvedValue({ ok: false, error: "kashier down" });
            const res = await post({ purpose: "new_academy", tier: "basic", name: "A", slug: "acme" });
            expect(res.status).toBe(502);
            expect(db.payment.update.mock.calls.at(-1)?.[0].data.status).toBe("failed");
        });
    });

    describe("upgrade (prorated)", () => {
        const ACADEMY = { slug: "acme", ownerId: "user-1", tier: "basic",
            validUntil: new Date(Date.now() + 100 * 86_400_000) };

        beforeEach(() => {
            db.tenant.findUnique.mockResolvedValue(ACADEMY);
            db.license.findUnique.mockResolvedValue({ key: "basic", priceEgp: 5000, durationDays: 365 });
            db.license.findFirst.mockResolvedValue({ key: "standard", priceEgp: 9000, durationDays: 365, active: true });
            db.subscription.findUnique.mockResolvedValue({ intervalDays: 365, autoRenew: true, status: "active" });
        });

        it("charges only the prorated difference for the remaining days and keeps the end date", async () => {
            const res = await post({ purpose: "upgrade", tier: "standard", slug: "acme" });
            expect(res.status).toBe(200);
            const body = await res.json();
            // (9000-5000)/365 * 100 days ≈ 1096.
            expect(body.prorated).toBe(1096);
            const data = db.payment.create.mock.calls[0][0].data;
            expect(data).toMatchObject({ licenseKey: "standard", purpose: "upgrade", amount: 1096 });
            expect(data.payloadJson).toMatchObject({
                proratedUpgrade: true, keepEnd: ACADEMY.validUntil.toISOString(), newFullPrice: 9000,
            });
        });

        it("403 when a client upgrades an academy they don't own", async () => {
            getCurrentUser.mockResolvedValue({ id: "intruder", role: "client", email: "x@x", name: "X" });
            expect((await post({ purpose: "upgrade", tier: "standard", slug: "acme" })).status).toBe(403);
        });

        it("400 when the target licence doesn't exist", async () => {
            db.license.findFirst.mockResolvedValue(null);
            expect((await post({ purpose: "upgrade", tier: "ghost", slug: "acme" })).status).toBe(400);
        });

        it("400 (contact_sales) when upgrading TO a contact-sales plan", async () => {
            db.license.findFirst.mockResolvedValue({ key: "pro", priceEgp: 9000, durationDays: 365, active: true, contactSales: true });
            const res = await post({ purpose: "upgrade", tier: "pro", slug: "acme" });
            expect(res.status).toBe(400);
            expect((await res.json()).errorcode).toBe("contact_sales");
        });
    });

    describe("update_card", () => {
        it("400 when subscriptions are disabled", async () => {
            subscriptionsEnabled.mockReturnValue(false);
            db.tenant.findUnique.mockResolvedValue({ slug: "acme", ownerId: "user-1", tier: "basic" });
            expect((await post({ purpose: "update_card", slug: "acme" })).status).toBe(400);
        });

        it("opens a verification charge for the owner and saves the card", async () => {
            db.tenant.findUnique.mockResolvedValue({ slug: "acme", ownerId: "user-1", tier: "basic" });
            const res = await post({ purpose: "update_card", slug: "acme" });
            expect(res.status).toBe(200);
            expect(db.payment.create.mock.calls[0][0].data.purpose).toBe("update_card");
            expect(createSession.mock.calls[0][0].saveCard).toBe(true);
        });
    });
});
