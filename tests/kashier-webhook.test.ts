import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const {
    db, verifyWebhook, isPaidStatus, provisionAcademy, licenseToDefinition,
    triggerSuspend, triggerExpiryReminder, computeUpgradable, notifyTelegram, openSubscription,
    createStore, pushStoreLicense, storeSuspend,
} = vi.hoisted(() => ({
    createStore: vi.fn(),
    pushStoreLicense: vi.fn(),
    storeSuspend: vi.fn(),
    db: {
        payment: { findUnique: vi.fn(), update: vi.fn() },
        license: { findFirst: vi.fn(), findMany: vi.fn() },
        tenant: { findUnique: vi.fn(), update: vi.fn() },
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
vi.mock("@/lib/tenants/createStore", () => ({ createStore, sanitizeStoreSettings: (v: unknown) => v ?? {} }));
vi.mock("@/lib/products/store", () => ({ pushStoreLicense, storeOps: { suspend: storeSuspend } }));

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
    db.tenant.update.mockResolvedValue({});
    db.tenant.findUnique.mockResolvedValue(null);
    db.paymentMethod.findFirst.mockResolvedValue(null);
    provisionAcademy.mockResolvedValue({ ok: true });
    triggerExpiryReminder.mockResolvedValue(undefined);
    triggerSuspend.mockResolvedValue(undefined);
    notifyTelegram.mockResolvedValue(undefined);
    openSubscription.mockResolvedValue(undefined);
    createStore.mockResolvedValue({ ok: true, slug: "ziad", job: 7, url: "https://ziad.commerce.nitg-eg.com" });
    pushStoreLicense.mockResolvedValue({ ok: true });
    storeSuspend.mockResolvedValue({ ok: true });
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
        expect(db.tenant.update).not.toHaveBeenCalled();
    });

    it("leaves auto-renew charges to the billing engine (subscriptionId set)", async () => {
        db.payment.findUnique.mockResolvedValue({ orderId: "acad_1", status: "pending", subscriptionId: "sub_1" });
        const body = await (await hook()).json();
        expect(body.status).toBe("handled-by-billing");
        expect(provisionAcademy).not.toHaveBeenCalled();
        expect(db.tenant.update).not.toHaveBeenCalled();
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

    it("new_store: queues the store from the stored payload once paid, opens the subscription when opted in", async () => {
        db.license.findFirst.mockResolvedValue({ key: "store-basic", product: "store", durationDays: 365, name: "Basic", limits: { products: 100 }, features: {} });
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "new_store", product: "store", mode: "live",
            licenseKey: "store-basic", userId: "user-1", amount: 1500, currency: "EGP",
            payloadJson: { slug: "ziad", name: "Ziad Store", name_ar: "متجر زياد", product: "store", store: { country: "EG" }, cycleDays: 30, owner_email: "o@x", owner_name: "O", locale: "ar", autoRenew: true },
        });
        const res = await hook();
        expect(res.status).toBe(200);
        expect(provisionAcademy).not.toHaveBeenCalled();
        expect(createStore).toHaveBeenCalledTimes(1);
        expect(createStore.mock.calls[0][0]).toMatchObject({ slug: "ziad", name: "Ziad Store", nameAr: "متجر زياد", durationDays: 30, licenseMode: "live", owner: { id: "user-1", email: "o@x", locale: "ar" } });
        expect(openSubscription.mock.calls[0][0]).toMatchObject({ tenantSlug: "ziad", intervalDays: 30, amountEgp: 1500 });
    });

    it("new_store: a failed queue is recorded on the payment (paid-but-provision-failed)", async () => {
        createStore.mockResolvedValue({ ok: false, error: "provisioner down", status: 503 });
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "new_store", product: "store", mode: "live",
            licenseKey: "store-basic", userId: "user-1", amount: 1500, currency: "EGP",
            payloadJson: { slug: "ziad", name: "Ziad Store", cycleDays: 365, owner_email: "o@x", owner_name: "O" },
        });
        await hook();
        expect(db.payment.update.mock.calls.some((c) => String(c[0].data?.failureReason ?? "").startsWith("paid-but-provision-failed"))).toBe(true);
        expect(openSubscription).not.toHaveBeenCalled();
    });

    it("renew of a STORE pushes the licence to the store provisioner, not to Moodle", async () => {
        db.tenant.findUnique.mockResolvedValue({ slug: "ziad", product: "store", status: "suspended", validUntil: null });
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "renew", product: "store", tenantSlug: "ziad", mode: "live",
            licenseKey: "store-basic", userId: "user-1", amount: 1500, currency: "EGP", payloadJson: { cycleDays: 365 },
        });
        await hook();
        expect(pushStoreLicense).toHaveBeenCalledWith("ziad");
        expect(storeSuspend).toHaveBeenCalledWith("ziad", false);
        expect(triggerSuspend).not.toHaveBeenCalled();
        expect(triggerExpiryReminder).not.toHaveBeenCalled();
        expect(db.tenant.update.mock.calls[0][0].data.status).toBe("live");
    });

    it("renew stacks the new term on remaining time and moves the academy live", async () => {
        const remaining = new Date(Date.now() + 30 * 86_400_000);
        db.payment.findUnique.mockResolvedValue({
            orderId: "acad_1", status: "pending", purpose: "renew", licenseKey: "basic",
            userId: "user-1", amount: 5000, currency: "EGP", tenantSlug: "acme",
            payloadJson: { cycleDays: 365, autoRenew: false },
        });
        db.tenant.findUnique.mockResolvedValue({ slug: "acme", status: "live", validUntil: remaining });

        const res = await hook();
        expect(res.status).toBe(200);
        const data = db.tenant.update.mock.calls[0][0].data;
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
            userId: "user-1", amount: 1096, currency: "EGP", tenantSlug: "acme",
            payloadJson: { proratedUpgrade: true, keepEnd: keep.toISOString(), cycleDays: 365, newFullPrice: 9000, autoRenew: false },
        });
        db.tenant.findUnique.mockResolvedValue({ slug: "acme", status: "live", validUntil: keep });

        const res = await hook();
        expect(res.status).toBe(200);
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data.tier).toBe("standard");
        expect((data.validUntil as Date).toISOString()).toBe(keep.toISOString());
    });
});
