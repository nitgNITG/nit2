import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const {
    db, verifyWebhook, isPaidStatus, provisionAcademy, licenseToDefinition,
    triggerSuspend, triggerExpiryReminder, computeUpgradable, notifyTelegram, openSubscription,
} = vi.hoisted(() => ({
    db: {
        payment: { findUnique: vi.fn(), update: vi.fn() },
        license: { findFirst: vi.fn(), findMany: vi.fn() },
        academy: { findUnique: vi.fn(), update: vi.fn() },
        paymentMethod: { findFirst: vi.fn() },
    },
    verifyWebhook: vi.fn(),
    isPaidStatus: vi.fn(),
    provisionAcademy: vi.fn(),
    licenseToDefinition: vi.fn(),
    triggerSuspend: vi.fn(),
    triggerExpiryReminder: vi.fn(),
    computeUpgradable: vi.fn(),
    notifyTelegram: vi.fn(),
    openSubscription: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/kashier", () => ({ verifyWebhook, isPaidStatus }));
vi.mock("@/lib/provisionAcademy", () => ({ provisionAcademy, licenseToDefinition, triggerSuspend, triggerExpiryReminder }));
vi.mock("@/lib/licenseDefinition", () => ({ computeUpgradable }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/billing", () => ({ openSubscription }));

import { POST } from "@/app/api/payments/kashier/webhook/route";

function hook() {
    return POST(new Request("http://localhost/api/payments/kashier/webhook", {
        method: "POST", body: "{}", headers: { "x-kashier-signature": "sig" },
    }) as any);
}

function verified(over: Record<string, unknown> = {}) {
    return {
        signatureValid: true, eventType: "pay", merchantOrderId: "acad_1",
        kashierOrderId: "k1", transactionId: "t1", status: "SUCCESS", raw: {}, ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // No provisioning server configured → triggerApplyLicense() no-ops (no fetch).
    delete process.env.PROVISION_URL;
    delete process.env.PROVISION_SECRET;
    verifyWebhook.mockReturnValue(verified());
    isPaidStatus.mockImplementation((s: string) => s === "SUCCESS");
    licenseToDefinition.mockReturnValue("{\"def\":1}");
    computeUpgradable.mockReturnValue(false);
    db.license.findFirst.mockResolvedValue({ key: "basic", durationDays: 365, videoSource: "vimeo", kashierEnabled: true });
    db.license.findMany.mockResolvedValue([]);
    db.payment.update.mockResolvedValue({});
    db.academy.update.mockResolvedValue({});
    db.academy.findUnique.mockResolvedValue(null);
    db.paymentMethod.findFirst.mockResolvedValue(null);
    provisionAcademy.mockResolvedValue({ ok: true });
    triggerExpiryReminder.mockResolvedValue(undefined);
    triggerSuspend.mockResolvedValue(undefined);
    notifyTelegram.mockResolvedValue(undefined);
    openSubscription.mockResolvedValue(undefined);
});

afterEach(() => {
    delete process.env.PROVISION_URL;
    delete process.env.PROVISION_SECRET;
});

describe("POST /api/payments/kashier/webhook", () => {
    it("401 on an invalid signature", async () => {
        verifyWebhook.mockReturnValue(verified({ signatureValid: false }));
        expect((await hook()).status).toBe(401);
    });

    it("acknowledges an unknown order without acting", async () => {
        db.payment.findUnique.mockResolvedValue(null);
        const body = await (await hook()).json();
        expect(body.status).toBe("unknown-order");
        expect(provisionAcademy).not.toHaveBeenCalled();
    });

    it("is idempotent — a paid payment is acknowledged, not reprocessed", async () => {
        db.payment.findUnique.mockResolvedValue({ orderId: "acad_1", status: "paid" });
        const body = await (await hook()).json();
        expect(body.status).toBe("already-processed");
        expect(db.academy.update).not.toHaveBeenCalled();
    });

    it("leaves auto-renew charges to the billing engine (subscriptionId set)", async () => {
        db.payment.findUnique.mockResolvedValue({ orderId: "acad_1", status: "pending", subscriptionId: "sub_1" });
        const body = await (await hook()).json();
        expect(body.status).toBe("handled-by-billing");
        expect(provisionAcademy).not.toHaveBeenCalled();
        expect(db.academy.update).not.toHaveBeenCalled();
    });

    it("records a failure on a non-success event", async () => {
        verifyWebhook.mockReturnValue(verified({ status: "FAILED" }));
        db.payment.findUnique.mockResolvedValue({ orderId: "acad_1", status: "pending" });
        const body = await (await hook()).json();
        expect(body.status).toBe("recorded-failure");
        expect(db.payment.update.mock.calls[0][0].data.status).toBe("failed");
    });

    it("provisions a new academy from the stored payload once paid", async () => {
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "new_academy",
            licenseKey: "basic", userId: "user-1", amount: 5000, currency: "EGP",
            payloadJson: { slug: "acme", name: "Acme", cycleDays: 365, owner_email: "o@x", owner_name: "O", autoRenew: false },
        });
        const res = await hook();
        expect(res.status).toBe(200);
        expect(provisionAcademy).toHaveBeenCalledTimes(1);
        const arg = provisionAcademy.mock.calls[0][0];
        expect(arg).toMatchObject({ slug: "acme", tier: "basic", durationDays: 365, definition: "{\"def\":1}" });
        // Marked paid (idempotency guard for a retry).
        expect(db.payment.update.mock.calls.some((c) => c[0].data?.status === "paid")).toBe(true);
    });

    it("renew stacks the new term on remaining time and moves the academy live", async () => {
        const remaining = new Date(Date.now() + 30 * 86_400_000);
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "renew", licenseKey: "basic",
            userId: "user-1", amount: 5000, currency: "EGP", academySlug: "acme",
            payloadJson: { cycleDays: 365, autoRenew: false },
        });
        db.academy.findUnique.mockResolvedValue({ slug: "acme", status: "live", validUntil: remaining });

        const res = await hook();
        expect(res.status).toBe(200);
        const data = db.academy.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ tier: "basic", status: "live" });
        // Stacked: 365 days added on top of the ~30 days still left (not from now).
        const expected = new Date(remaining.getTime() + 365 * 86_400_000).getTime();
        expect(Math.abs((data.validUntil as Date).getTime() - expected)).toBeLessThan(5000);
        expect(triggerExpiryReminder).toHaveBeenCalled();
    });

    it("a prorated upgrade keeps the same end date (no extra time bought)", async () => {
        const keep = new Date(Date.now() + 100 * 86_400_000);
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "upgrade", licenseKey: "standard",
            userId: "user-1", amount: 1096, currency: "EGP", academySlug: "acme",
            payloadJson: { proratedUpgrade: true, keepEnd: keep.toISOString(), cycleDays: 365, newFullPrice: 9000, autoRenew: false },
        });
        db.academy.findUnique.mockResolvedValue({ slug: "acme", status: "live", validUntil: keep });

        const res = await hook();
        expect(res.status).toBe(200);
        const data = db.academy.update.mock.calls[0][0].data;
        expect(data.tier).toBe("standard");
        expect((data.validUntil as Date).toISOString()).toBe(keep.toISOString());
    });
});
