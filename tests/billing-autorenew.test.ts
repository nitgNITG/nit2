import { describe, it, expect, beforeEach, vi } from "vitest";

const {
    db, subs, decryptSecret, notifyTelegram, triggerSuspend, triggerExpiryReminder, payWithToken,
} = vi.hoisted(() => ({
    db: {
        subscription: { findMany: vi.fn(), update: vi.fn() },
        payment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        paymentMethod: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
        academy: { update: vi.fn() },
    },
    subs: {
        subscriptionsEnabled: vi.fn(),
        billingRetryDays: vi.fn(),
        billingCycleKey: vi.fn(),
        renewLeadDaysResolved: vi.fn(),
        preRenewNoticeDaysResolved: vi.fn(),
        billingCooldownHours: vi.fn(),
        scheduleNextAttempt: vi.fn(),
    },
    decryptSecret: vi.fn(),
    notifyTelegram: vi.fn(),
    triggerSuspend: vi.fn(),
    triggerExpiryReminder: vi.fn(),
    payWithToken: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/subscriptions", () => subs);
vi.mock("@/lib/secretBox", () => ({ decryptSecret }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerSuspend, triggerExpiryReminder }));
vi.mock("@/lib/kashierOrders", () => ({ payWithToken }));

import { runBillingCycle } from "@/lib/billing";

const NEXT = new Date("2099-01-01T00:00:00Z"); // sentinel scheduleNextAttempt result
const DAY = 86_400_000;

function makeSub(over: Record<string, unknown> = {}) {
    return {
        id: "sub_1", academySlug: "acme", userId: "user-1", licenseKey: "basic",
        amountEgp: 5000, currency: "EGP", intervalDays: 365,
        currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
        attemptCount: 0, paymentMethodId: "pm-1", status: "active", autoRenew: true,
        ...over,
    };
}
const PM = { id: "pm-1", cardTokenEnc: "enc", last4: "4242", customerReference: "cust-1", expMonth: 12, expYear: 2030 };

beforeEach(() => {
    vi.clearAllMocks();
    subs.subscriptionsEnabled.mockReturnValue(true);
    subs.billingRetryDays.mockReturnValue([1, 3, 7]);
    subs.billingCycleKey.mockReturnValue("2027-01");
    subs.renewLeadDaysResolved.mockResolvedValue(7);
    subs.billingCooldownHours.mockReturnValue(0);
    subs.scheduleNextAttempt.mockReturnValue(NEXT);

    db.subscription.findMany.mockResolvedValue([makeSub()]);
    db.subscription.update.mockResolvedValue({});
    db.payment.findFirst.mockResolvedValue(null);
    db.payment.create.mockResolvedValue({});
    db.payment.update.mockResolvedValue({});
    db.paymentMethod.findUnique.mockResolvedValue(PM);
    db.paymentMethod.findFirst.mockResolvedValue(PM);
    db.paymentMethod.update.mockResolvedValue({});
    db.academy.update.mockResolvedValue({});
    decryptSecret.mockReturnValue("tok_live");
    payWithToken.mockResolvedValue({ ok: true, transactionId: "txn-1", expMonth: 12, expYear: 2030 });
    triggerExpiryReminder.mockResolvedValue(undefined);
    triggerSuspend.mockResolvedValue(undefined);
    notifyTelegram.mockResolvedValue(undefined);
});

describe("runBillingCycle", () => {
    it("is a no-op when the feature is off", async () => {
        subs.subscriptionsEnabled.mockReturnValue(false);
        const s = await runBillingCycle("https://app");
        expect(s.skipped).toBe(true);
        expect(db.subscription.findMany).not.toHaveBeenCalled();
    });

    it("charges a due subscription, extends the term, and marks it renewed", async () => {
        const s = await runBillingCycle("https://app");

        expect(payWithToken).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 5000, currency: "EGP", cardToken: "tok_live", customerReference: "cust-1" }),
        );
        expect(s.renewed).toEqual(["acme"]);
        expect(s.failed).toEqual([]);

        // Term extends from currentPeriodEnd (+intervalDays), not from "now".
        const expectedEnd = new Date(Date.parse("2027-01-01T00:00:00Z") + 365 * DAY);
        expect((db.academy.update.mock.calls[0][0].data.validUntil as Date).toISOString()).toBe(expectedEnd.toISOString());
        expect(db.academy.update.mock.calls[0][0].data.status).toBe("live");

        const subData = db.subscription.update.mock.calls[0][0].data;
        expect(subData).toMatchObject({ status: "active", attemptCount: 0, lastError: null, nextAttemptAt: NEXT });
        expect((subData.currentPeriodEnd as Date).toISOString()).toBe(expectedEnd.toISOString());

        // Payment marked paid + a receipt email + resume any suspension.
        expect(db.payment.update.mock.calls.some((c) => c[0].data?.status === "paid")).toBe(true);
        expect(triggerExpiryReminder.mock.calls[0][1]).toBeTypeOf("number"); // daysLeft
        expect(triggerExpiryReminder.mock.calls[0][3]).toMatchObject({ mode: "receipt", autoRenew: true });
        expect(triggerSuspend).toHaveBeenCalledWith("acme", false);
    });

    it("never charges the same cycle twice — advances the schedule instead", async () => {
        db.payment.findFirst.mockResolvedValueOnce({ id: "already-paid" }); // idempotency hit
        const s = await runBillingCycle("https://app");
        expect(payWithToken).not.toHaveBeenCalled();
        expect(s.renewed).toEqual([]);
        expect(db.subscription.update.mock.calls[0][0].data).toEqual({ nextAttemptAt: NEXT });
    });

    it("respects the cooldown — skips a card charged within the window", async () => {
        subs.billingCooldownHours.mockReturnValue(24);
        db.payment.findFirst
            .mockResolvedValueOnce(null) // idempotency: none
            .mockResolvedValueOnce({ paidAt: new Date() }); // cooldown: recent charge
        const s = await runBillingCycle("https://app");
        expect(payWithToken).not.toHaveBeenCalled();
        expect(s.renewed).toEqual([]);
    });

    it("marks past_due when there's no saved card token", async () => {
        db.paymentMethod.findUnique.mockResolvedValue(null);
        const s = await runBillingCycle("https://app");
        expect(payWithToken).not.toHaveBeenCalled();
        expect(s.failed).toEqual(["acme"]);
        expect(db.subscription.update.mock.calls[0][0].data.status).toBe("past_due");
    });

    it("on a decline: fails the payment, sets past_due with the retry ladder, sends dunning", async () => {
        payWithToken.mockResolvedValue({ ok: false, error: "insufficient funds" });
        const s = await runBillingCycle("https://app");

        expect(s.failed).toEqual(["acme"]);
        expect(db.payment.update.mock.calls.some((c) => c[0].data?.status === "failed")).toBe(true);

        const subData = db.subscription.update.mock.calls[0][0].data;
        expect(subData).toMatchObject({ status: "past_due", attemptCount: 1, lastError: "insufficient funds" });
        // First retry = 1 day out (ladder[0]).
        expect(Math.abs((subData.nextAttemptAt as Date).getTime() - (Date.now() + 1 * DAY))).toBeLessThan(10_000);

        // Dunning email, not a receipt.
        expect(triggerExpiryReminder.mock.calls[0][3]).toMatchObject({ mode: "payment_failed" });
        // The academy term is NOT extended on a failed charge.
        expect(db.academy.update).not.toHaveBeenCalled();
    });

    it("routes a 3DS/step-up decline to needsAuth (not silently failed)", async () => {
        payWithToken.mockResolvedValue({ ok: false, error: "auth required", needsAuth: true });
        const s = await runBillingCycle("https://app");
        expect(s.needsAuth).toEqual(["acme"]);
        expect(s.failed).toEqual([]);
    });
});
