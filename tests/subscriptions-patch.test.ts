import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, getCurrentUser, triggerExpiryReminder, notifyTelegram, renewLeadDaysResolved } = vi.hoisted(() => ({
    db: { subscription: { findUnique: vi.fn(), update: vi.fn() } },
    getCurrentUser: vi.fn(),
    triggerExpiryReminder: vi.fn(),
    notifyTelegram: vi.fn(),
    renewLeadDaysResolved: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerExpiryReminder }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/subscriptions", () => ({ renewLeadDaysResolved }));

import { PATCH } from "@/app/api/subscriptions/[slug]/route";

const SUB = {
    academySlug: "acme", userId: "user-1", autoRenew: true, status: "active",
    currentPeriodEnd: new Date("2027-07-01T00:00:00Z"),
};

function call(bodyObj: unknown, slug = "acme") {
    const req = new Request(`http://localhost/api/subscriptions/${slug}`, {
        method: "PATCH",
        body: bodyObj === undefined ? "not-json" : JSON.stringify(bodyObj),
        headers: { "Content-Type": "application/json" },
    });
    return PATCH(req as any, { params: { slug } });
}

beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "client" });
    db.subscription.findUnique.mockResolvedValue(SUB);
    db.subscription.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...SUB, ...data }));
    triggerExpiryReminder.mockResolvedValue(undefined);
    notifyTelegram.mockResolvedValue(undefined);
    renewLeadDaysResolved.mockResolvedValue(7);
});

describe("PATCH /api/subscriptions/[slug]", () => {
    it("401 when not signed in", async () => {
        getCurrentUser.mockResolvedValue(null);
        expect((await call({ autoRenew: false })).status).toBe(401);
    });

    it("400 on bad JSON", async () => {
        expect((await call(undefined)).status).toBe(400);
    });

    it("400 when autoRenew is missing / not a boolean", async () => {
        expect((await call({})).status).toBe(400);
        expect((await call({ autoRenew: "yes" })).status).toBe(400);
    });

    it("404 when there is no subscription for the academy", async () => {
        db.subscription.findUnique.mockResolvedValue(null);
        expect((await call({ autoRenew: false })).status).toBe(404);
    });

    it("403 when a client toggles someone else's subscription", async () => {
        getCurrentUser.mockResolvedValue({ id: "intruder", role: "client" });
        expect((await call({ autoRenew: false })).status).toBe(403);
    });

    it("cancels auto-renew: persists canceled + clears nextAttemptAt, syncs the banner", async () => {
        const res = await call({ autoRenew: false });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ ok: true, autoRenew: false, status: "canceled" });

        const data = db.subscription.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ autoRenew: false, status: "canceled", nextAttemptAt: null });
        expect(data.canceledAt).toBeInstanceOf(Date);
        // The in-academy banner flag is pushed too.
        expect(triggerExpiryReminder).toHaveBeenCalledWith("acme", 0, "", { sendEmail: false, autoRenew: false });
    });

    it("resumes auto-renew: re-arms nextAttemptAt lead days before period end", async () => {
        const res = await call({ autoRenew: true });
        expect(res.status).toBe(200);
        const data = db.subscription.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ autoRenew: true, status: "active", canceledAt: null });
        // 7 lead days before 2027-07-01 → 2027-06-24.
        expect((data.nextAttemptAt as Date).toISOString()).toBe("2027-06-24T00:00:00.000Z");
    });

    it("lets an admin toggle any subscription", async () => {
        getCurrentUser.mockResolvedValue({ id: "admin-9", role: "admin" });
        expect((await call({ autoRenew: false })).status).toBe(200);
    });
});
