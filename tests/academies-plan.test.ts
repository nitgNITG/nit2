import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks (hoisted so the vi.mock factories can see them) ────────────────────
const { db, getCurrentUser } = vi.hoisted(() => ({
    db: {
        academy: { findUnique: vi.fn() },
        license: { findUnique: vi.fn(), findMany: vi.fn() },
        subscription: { findUnique: vi.fn() },
        paymentMethod: { findUnique: vi.fn(), findFirst: vi.fn() },
        payment: { findMany: vi.fn() },
    },
    getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { GET } from "@/app/api/academies/[slug]/plan/route";

const OWNER = { id: "user-1", role: "client" };
const ACADEMY = {
    slug: "acme", name: "Acme", status: "live", tier: "basic",
    ownerId: "user-1", subscribedAt: new Date("2026-07-01T00:00:00Z"),
    validUntil: new Date("2027-07-01T00:00:00Z"),
};
const LICENSE = {
    key: "basic", name: "Basic", price: 100, priceEgp: 5000, durationDays: 365,
    maxCourses: 3, maxTeachers: 1, storageGb: 5, videoSource: "vimeo",
    supportedApp: true, kashierEnabled: true, limits: { quiz: -1 }, features: { coupons: true },
};

function call(slug = "acme") {
    return GET(new Request(`http://localhost/api/academies/${slug}/plan`), { params: { slug } });
}

beforeEach(() => {
    vi.clearAllMocks();
    // Sensible defaults for the happy path; individual tests override.
    getCurrentUser.mockResolvedValue(OWNER);
    db.academy.findUnique.mockResolvedValue(ACADEMY);
    db.license.findUnique.mockResolvedValue(LICENSE);
    db.license.findMany.mockResolvedValue([
        { key: "standard", name: "Standard", price: 200, priceEgp: 9000, durationDays: 365,
          storageGb: 20, maxCourses: 10, maxTeachers: 5, videoSource: "vimeo", features: {} },
    ]);
    db.subscription.findUnique.mockResolvedValue(null);
    db.paymentMethod.findUnique.mockResolvedValue(null);
    db.paymentMethod.findFirst.mockResolvedValue(null);
    db.payment.findMany.mockResolvedValue([]);
});

describe("GET /api/academies/[slug]/plan", () => {
    it("401 when not signed in", async () => {
        getCurrentUser.mockResolvedValue(null);
        const res = await call();
        expect(res.status).toBe(401);
    });

    it("404 when the academy does not exist", async () => {
        db.academy.findUnique.mockResolvedValue(null);
        const res = await call("ghost");
        expect(res.status).toBe(404);
    });

    it("403 when a client asks for an academy they don't own", async () => {
        getCurrentUser.mockResolvedValue({ id: "someone-else", role: "client" });
        const res = await call();
        expect(res.status).toBe(403);
    });

    it("lets an admin view any academy", async () => {
        getCurrentUser.mockResolvedValue({ id: "admin-9", role: "admin" });
        const res = await call();
        expect(res.status).toBe(200);
    });

    it("returns the full package incl. price + storage, the subscription term, and the actions block", async () => {
        const res = await call();
        expect(res.status).toBe(200);
        const body = await res.json();

        // Subscription term (the values that were reported empty before the fix).
        expect(body.academy.subscribedAt).toBe(ACADEMY.subscribedAt.toISOString());
        expect(body.academy.validUntil).toBe(ACADEMY.validUntil.toISOString());

        // Package resources + billing (price lives here, not in the academy).
        expect(body.package.price).toBe(100);
        expect(body.package.storageGb).toBe(5);
        expect(body.package.maxCourses).toBe(3);

        // The web + API upgrade/renew capabilities.
        expect(body.actions.renew.body).toMatchObject({ purpose: "renew", slug: "acme" });
        expect(body.actions.upgrade.body.purpose).toBe("upgrade");
        expect(body.actions.upgrade.options).toHaveLength(1);
        expect(body.actions.upgrade.options[0].key).toBe("standard");
        expect(body.actions.setAutoRenew.method).toBe("PATCH");
    });

    it("includes the saved card when a subscription + payment method exist", async () => {
        db.subscription.findUnique.mockResolvedValue({
            status: "active", autoRenew: true, licenseKey: "basic", amountEgp: 5000,
            currency: "EGP", intervalDays: 365, currentPeriodEnd: ACADEMY.validUntil,
            nextAttemptAt: null, lastError: null, paymentMethodId: "pm-1", userId: "user-1",
        });
        db.paymentMethod.findUnique.mockResolvedValue({ brand: "visa", last4: "4242" });
        const res = await call();
        const body = await res.json();
        expect(body.subscription.card).toEqual({ brand: "visa", last4: "4242" });
    });
});
