import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { db, getCurrentUser, triggerApplyIntegrations, triggerExpiryReminder, notifyTelegram, toLicenseDefinition, computeUpgradable } = vi.hoisted(() => ({
    db: {
        academy: { findUnique: vi.fn(), update: vi.fn() },
        license: { findUnique: vi.fn(), findMany: vi.fn() },
    },
    getCurrentUser: vi.fn(),
    triggerApplyIntegrations: vi.fn(),
    triggerExpiryReminder: vi.fn(),
    notifyTelegram: vi.fn(),
    toLicenseDefinition: vi.fn(),
    computeUpgradable: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerApplyIntegrations, triggerExpiryReminder }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/licenseDefinition", () => ({ toLicenseDefinition, computeUpgradable }));

import { PATCH } from "@/app/api/academies/[slug]/route";

const ADMIN = { id: "admin-1", role: "admin" };
const DAY = 86_400_000;

function patch(body: unknown, headers: Record<string, string> = {}, slug = "acme") {
    const req = new Request(`http://localhost/api/academies/${slug}`, {
        method: "PATCH", body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", ...headers },
    });
    return PATCH(req as any, { params: { slug } });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.WORKER_SECRET = "wsecret";
    delete process.env.PROVISION_URL;   // trigger* helpers no-op → no network
    delete process.env.PROVISION_SECRET;

    getCurrentUser.mockResolvedValue(ADMIN);
    db.license.findUnique.mockResolvedValue({ key: "standard", durationDays: 365 });
    db.license.findMany.mockResolvedValue([]);
    db.academy.findUnique.mockResolvedValue({ slug: "acme", status: "live" });
    db.academy.update.mockImplementation(({ data }: any) => Promise.resolve({
        slug: "acme", status: data.status ?? "live", tier: data.tier ?? "basic",
        validUntil: data.validUntil ?? null, googleOauthAdded: data.googleOauthAdded ?? false,
    }));
    triggerExpiryReminder.mockResolvedValue(undefined);
    triggerApplyIntegrations.mockResolvedValue(undefined);
    notifyTelegram.mockResolvedValue(undefined);
});

afterEach(() => { delete process.env.WORKER_SECRET; });

describe("PATCH /api/academies/[slug]", () => {
    it("400 when nothing actionable is sent", async () => {
        expect((await patch({})).status).toBe(400);
        expect(db.academy.update).not.toHaveBeenCalled();
    });

    describe("status transition (worker-guarded)", () => {
        it("401 with a wrong worker secret", async () => {
            expect((await patch({ status: "live" }, { "x-worker-secret": "nope" })).status).toBe(401);
        });
        it("400 on an invalid status value", async () => {
            expect((await patch({ status: "bogus" }, { "x-worker-secret": "wsecret" })).status).toBe(400);
        });
        it("advances the status with the right secret", async () => {
            const res = await patch({ status: "live" }, { "x-worker-secret": "wsecret" });
            expect(res.status).toBe(200);
            expect(db.academy.update.mock.calls[0][0].data.status).toBe("live");
        });
        it("notifies on a failed build", async () => {
            await patch({ status: "failed" }, { "x-worker-secret": "wsecret" });
            expect(notifyTelegram.mock.calls.some((c) => /build FAILED/i.test(c[0]))).toBe(true);
        });
    });

    describe("tier change (admin-guarded)", () => {
        it("401 when not signed in", async () => {
            getCurrentUser.mockResolvedValue(null);
            expect((await patch({ tier: "standard" })).status).toBe(401);
        });
        it("403 for a non-admin", async () => {
            getCurrentUser.mockResolvedValue({ id: "c", role: "client" });
            expect((await patch({ tier: "standard" })).status).toBe(403);
        });
        it("400 for an unknown licence", async () => {
            db.license.findUnique.mockResolvedValue(null);
            expect((await patch({ tier: "ghost" })).status).toBe(400);
        });
        it("starts a fresh term and pushes the plan to the live academy", async () => {
            const res = await patch({ tier: "STANDARD" }); // case-insensitive
            expect(res.status).toBe(200);
            const data = db.academy.update.mock.calls[0][0].data;
            expect(data.tier).toBe("standard");
            expect(data.subscribedAt).toBeInstanceOf(Date);
            expect(data.expiryRemindersSent).toEqual({});
            const yearOut = Date.now() + 365 * DAY;
            expect(Math.abs((data.validUntil as Date).getTime() - yearOut)).toBeLessThan(60_000);
            expect(notifyTelegram.mock.calls.some((c) => /plan changed/i.test(c[0]))).toBe(true);
        });
        it("a never-expiring tier gets a null term", async () => {
            db.license.findUnique.mockResolvedValue({ key: "free", durationDays: 0 });
            await patch({ tier: "free" });
            expect(db.academy.update.mock.calls[0][0].data.validUntil).toBeNull();
        });
    });

    describe("suspend / resume (admin-guarded)", () => {
        it("403 for a non-admin", async () => {
            getCurrentUser.mockResolvedValue({ id: "c", role: "client" });
            expect((await patch({ suspend: true })).status).toBe(403);
        });
        it("suspends: status suspended + notify", async () => {
            const res = await patch({ suspend: true });
            expect(res.status).toBe(200);
            expect(db.academy.update.mock.calls[0][0].data.status).toBe("suspended");
            expect(notifyTelegram.mock.calls.some((c) => /suspended/i.test(c[0]))).toBe(true);
        });
    });

    describe("validUntil extension (admin-guarded)", () => {
        it("400 on an invalid date", async () => {
            expect((await patch({ validUntil: "not-a-date" })).status).toBe(400);
        });
        it("sets the date, re-arms reminders, and syncs the banner without email", async () => {
            const future = new Date(Date.now() + 200 * DAY).toISOString();
            const res = await patch({ validUntil: future });
            expect(res.status).toBe(200);
            const data = db.academy.update.mock.calls[0][0].data;
            expect((data.validUntil as Date).toISOString()).toBe(future);
            expect(data.expiryRemindersSent).toEqual({});
            expect(triggerExpiryReminder.mock.calls[0][3]).toMatchObject({ sendEmail: false });
        });
        it("revives a suspended academy when extended into the future", async () => {
            // First update returns the row still suspended; the revive path flips it live.
            db.academy.update.mockResolvedValueOnce({ slug: "acme", status: "suspended", tier: "basic", validUntil: null, googleOauthAdded: false });
            const future = new Date(Date.now() + 30 * DAY).toISOString();
            const res = await patch({ validUntil: future });
            const body = await res.json();
            expect(body.status).toBe("live");
            // Second update flips status → live.
            expect(db.academy.update.mock.calls[1][0].data).toEqual({ status: "live" });
        });
    });

    it("flips the googleOauthAdded flag (admin)", async () => {
        const res = await patch({ googleOauthAdded: true });
        expect(res.status).toBe(200);
        expect(db.academy.update.mock.calls[0][0].data.googleOauthAdded).toBe(true);
    });

    it("404 when the academy row doesn't exist (P2025)", async () => {
        db.academy.update.mockRejectedValue({ code: "P2025" });
        expect((await patch({ googleOauthAdded: true })).status).toBe(404);
    });

    describe("updateImage (admin-guarded)", () => {
        it("kicks off a container rebuild for a live academy", async () => {
            const res = await patch({ updateImage: true });
            expect(res.status).toBe(200);
            expect((await res.json()).status).toBe("updating-image");
        });
        it("404 when the academy isn't found", async () => {
            db.academy.findUnique.mockResolvedValue(null);
            expect((await patch({ updateImage: true })).status).toBe(404);
        });
        it("409 when the academy isn't live yet", async () => {
            db.academy.findUnique.mockResolvedValue({ slug: "acme", status: "branch_created" });
            expect((await patch({ updateImage: true })).status).toBe(409);
        });
    });
});
