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

import { runBillingCycle, runPreRenewNotices, weeklyBillingSummary } from "@/lib/billing";

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
    subs.preRenewNoticeDaysResolved.mockResolvedValue(3);
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

describe("runPreRenewNotices", () => {
    const soon = () => new Date(Date.now() + 2 * DAY); // inside a 3-day notice window

    it("is a no-op when the feature is off", async () => {
        subs.subscriptionsEnabled.mockReturnValue(false);
        expect(await runPreRenewNotices("https://app")).toEqual({ skipped: true });
        expect(db.subscription.findMany).not.toHaveBeenCalled();
    });

    it("notifies nobody when the notice window is disabled (0 days)", async () => {
        subs.preRenewNoticeDaysResolved.mockResolvedValue(0);
        expect(await runPreRenewNotices("https://app")).toEqual({ notified: [] });
        expect(db.subscription.findMany).not.toHaveBeenCalled();
    });

    it("emails a heads-up, marks it sent once, and returns the slug", async () => {
        db.subscription.findMany.mockResolvedValue([makeSub({ nextAttemptAt: soon() })]);
        const res = await runPreRenewNotices("https://app");
        expect(res).toEqual({ notified: ["acme"] });

        const opts = triggerExpiryReminder.mock.calls[0][3];
        expect(opts).toMatchObject({ mode: "prerenew", amountEgp: 5000, cardLast4: "4242", cardExpiring: false });
        // "notified once" flag persisted so the next cron pass skips it.
        expect(db.subscription.update.mock.calls[0][0].data).toHaveProperty("preRenewNotifiedAt");
    });

    it("flags cardExpiring when the saved card expires before the charge date", async () => {
        db.subscription.findMany.mockResolvedValue([makeSub({ nextAttemptAt: soon() })]);
        db.paymentMethod.findUnique.mockResolvedValue({ ...PM, expMonth: 1, expYear: 2020 }); // long expired
        await runPreRenewNotices("https://app");
        expect(triggerExpiryReminder.mock.calls[0][3].cardExpiring).toBe(true);
    });
});

describe("weeklyBillingSummary", () => {
    it("is a no-op when the feature is off", async () => {
        subs.subscriptionsEnabled.mockReturnValue(false);
        expect(await weeklyBillingSummary()).toEqual({ posted: false });
        expect(notifyTelegram).not.toHaveBeenCalled();
    });

    it("does not post when there are no subscriptions", async () => {
        db.subscription.findMany.mockResolvedValue([]);
        expect(await weeklyBillingSummary()).toEqual({ posted: false });
        expect(notifyTelegram).not.toHaveBeenCalled();
    });

    it("posts active/past-due/cancelled counts and an MRR estimate", async () => {
        db.subscription.findMany.mockResolvedValue([
            { status: "active", autoRenew: true, amountEgp: 1200, intervalDays: 365 },  // annual → /12 MRR
            { status: "active", autoRenew: true, amountEgp: 500, intervalDays: 30 },    // monthly → full
            { status: "past_due", autoRenew: true, amountEgp: 500, intervalDays: 30 },
            { status: "canceled", autoRenew: false, amountEgp: 999, intervalDays: 30 }, // excluded from MRR
        ]);
        const res = await weeklyBillingSummary();
        expect(res).toEqual({ posted: true });
        const msg = notifyTelegram.mock.calls[0][0] as string;
        // 2 active · 1 past-due · 1 cancelled; MRR = 1200/12 + 500 (monthly active)
        // + 500 (past-due still counts, not cancelled) = 1100.
        expect(msg).toContain("2 active");
        expect(msg).toContain("1 past-due");
        expect(msg).toContain("1 cancelled");
        expect(msg).toContain("1100");
    });
});
