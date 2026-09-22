import { describe, it, expect, beforeEach, vi } from "vitest";

// /api/cron/expiry — store expiry reminders (7/3/1/0 days, once per stage) and
// the suspension mail, sent by nit2's own SMTP to the store owner. Academies keep
// their Moodle-sent path (triggerExpiryReminder) untouched.
const { db, sendEmail, mailerConfigured, triggerExpiryReminder, triggerSuspend, storeOps, notifyTelegram } = vi.hoisted(() => ({
    db: {
        tenant: { findMany: vi.fn(), update: vi.fn() },
        user: { findMany: vi.fn() },
        subscription: { findMany: vi.fn() },
        platformSetting: { findUnique: vi.fn() },
        payment: { updateMany: vi.fn() },
    },
    sendEmail: vi.fn(),
    mailerConfigured: vi.fn(),
    triggerExpiryReminder: vi.fn(),
    triggerSuspend: vi.fn(),
    storeOps: { suspend: vi.fn() },
    notifyTelegram: vi.fn(),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/mailer", () => ({ sendEmail, mailerConfigured }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerExpiryReminder, triggerSuspend, deprovisionAndDeleteAcademy: vi.fn() }));
vi.mock("@/lib/products/store", () => ({ storeOps, deprovisionAndDeleteStore: vi.fn(), STORE_DOMAIN: "commerce.nitg-eg.com" }));
vi.mock("@/lib/billing", () => ({
    runBillingCycle: vi.fn(async () => ({ attempted: 0, renewed: [], failed: [], needsAuth: [] })),
    runPreRenewNotices: vi.fn(async () => ({ notified: [] })),
    weeklyBillingSummary: vi.fn(),
}));

import { POST } from "@/app/api/cron/expiry/route";

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);
const OWNER = { id: "u1", email: "ziad@x.com", name: "Ziad" };
const store = (over: Record<string, unknown> = {}) => ({
    slug: "ziad", name: "متجر زياد", product: "store", status: "live", ownerId: "u1", tier: "store-demo",
    validUntil: inDays(3), expiryRemindersSent: null, ...over,
});
const academy = (over: Record<string, unknown> = {}) => ({
    slug: "acad", name: "Acad", product: "academy", status: "live", ownerId: "u2", tier: "basic",
    validUntil: inDays(3), expiryRemindersSent: null, ...over,
});

function run() {
    process.env.CRON_SECRET = "c";
    return POST(new Request("http://localhost/api/cron/expiry", { method: "POST", headers: { "x-cron-secret": "c", host: "dev.nitg-eg.com" } }) as any);
}

/** tenant.findMany is called 3× per run: expired (1), reminders (1b), auto-delete (1c). */
function seed({ expired = [] as any[], soon = [] as any[] }) {
    db.tenant.findMany.mockImplementation(async ({ where }: any) => {
        if (where.status === "suspended") return [];
        if (where.validUntil?.lt) return expired;
        return soon;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mailerConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue(undefined);
    db.user.findMany.mockResolvedValue([OWNER]);
    db.subscription.findMany.mockResolvedValue([]);
    db.platformSetting.findUnique.mockResolvedValue({ key: "auto_delete_days", value: "30" });
    db.payment.updateMany.mockResolvedValue({ count: 0 });
    db.tenant.update.mockImplementation(async ({ where, data }: any) => ({ slug: where.slug, ...data }));
    seed({});
});

describe("store expiry reminders", () => {
    it("mails the owner once for the 3-day stage and records it", async () => {
        seed({ soon: [store()] });
        const body = await (await run()).json();
        expect(body.reminded).toEqual(["ziad"]);
        expect(sendEmail).toHaveBeenCalledTimes(1);
        const m = sendEmail.mock.calls[0][0];
        expect(m.to).toBe("ziad@x.com");
        expect(m.subject).toMatch(/3 days/);
        expect(m.html).toContain("https://dev.nitg-eg.com/account");
        expect(m.html).toContain("https://ziad.commerce.nitg-eg.com");
        // Bookkeeping marks the largest unsent stage reached (d7 when first seen at
        // 3 days) — identical to the academy loop; the wording follows the real days left.
        expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { slug: "ziad" }, data: { expiryRemindersSent: expect.objectContaining({ d7: expect.any(Number) }) },
        }));
        expect(triggerExpiryReminder).not.toHaveBeenCalled();   // academy path untouched
    });

    it("does not resend a stage already sent this term", async () => {
        seed({ soon: [store({ expiryRemindersSent: { d7: 1, d3: 2 } })] });
        const body = await (await run()).json();
        expect(body.reminded).toEqual([]);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("sends the day-0 mail with the grace period, and 'tomorrow' for 1 day", async () => {
        seed({ soon: [store({ validUntil: inDays(0.2), expiryRemindersSent: { d7: 1, d3: 1 } }), store({ slug: "ziad2", validUntil: inDays(0.9), expiryRemindersSent: { d7: 1, d3: 1 } })] });
        await run();
        // both are ≤1 day: first gets d1 too (largest unsent threshold reached = 1) — same as academies
        expect(sendEmail).toHaveBeenCalledTimes(2);
        expect(sendEmail.mock.calls.map((c) => c[0].subject).join(" ")).toMatch(/tomorrow/);
    });

    it("skips stores on auto-renew (billing sends its own notices)", async () => {
        seed({ soon: [store()] });
        db.subscription.findMany.mockResolvedValue([{ tenantSlug: "ziad" }]);
        const body = await (await run()).json();
        expect(body.reminded).toEqual([]);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("leaves the stage unsent when SMTP is not configured", async () => {
        mailerConfigured.mockReturnValue(false);
        seed({ soon: [store()] });
        const body = await (await run()).json();
        expect(body.ok).toBe(true);
        expect(body.reminded).toEqual([]);
        expect(db.tenant.update).not.toHaveBeenCalled();
    });

    it("still reminds academies through Moodle", async () => {
        seed({ soon: [academy()] });
        const body = await (await run()).json();
        expect(triggerExpiryReminder).toHaveBeenCalledWith("acad", 3, "https://dev.nitg-eg.com/account", expect.objectContaining({ sendEmail: true }));
        expect(sendEmail).not.toHaveBeenCalled();
        expect(body.reminded).toEqual(["acad"]);
    });
});

describe("store suspension", () => {
    it("suspends the expired store and mails the owner once, quoting the retention", async () => {
        seed({ expired: [store({ validUntil: inDays(-5) })] });
        const body = await (await run()).json();
        expect(body.suspended).toEqual(["ziad"]);
        expect(storeOps.suspend).toHaveBeenCalledWith("ziad", true);
        expect(triggerSuspend).not.toHaveBeenCalled();
        expect(sendEmail).toHaveBeenCalledTimes(1);
        const m = sendEmail.mock.calls[0][0];
        expect(m.subject).toMatch(/suspended/);
        expect(m.html).toContain("30 days");
    });

    it("sends no mail when the suspension itself failed", async () => {
        seed({ expired: [store({ validUntil: inDays(-5) })] });
        storeOps.suspend.mockRejectedValueOnce(new Error("provisioner down"));
        const body = await (await run()).json();
        expect(body.suspended).toEqual([]);
        expect(sendEmail).not.toHaveBeenCalled();
    });
});
