import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const {
    db, getCurrentUser, toLicenseDefinition, computeUpgradable, sanitizeBrand,
    generateAdminPassword, encryptSecret, buildIntegrationEnv, notifyTelegram,
    evaluateServerHealth, alertAdmins, mailerConfigured, createAndSendOtp,
} = vi.hoisted(() => ({
    db: {
        license: { findFirst: vi.fn(), findMany: vi.fn() },
        platformSetting: { findMany: vi.fn(), findUnique: vi.fn() },
        academy: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
        user: { findUnique: vi.fn() },
    },
    getCurrentUser: vi.fn(),
    toLicenseDefinition: vi.fn(),
    computeUpgradable: vi.fn(),
    sanitizeBrand: vi.fn(),
    generateAdminPassword: vi.fn(),
    encryptSecret: vi.fn(),
    buildIntegrationEnv: vi.fn(),
    notifyTelegram: vi.fn(),
    evaluateServerHealth: vi.fn(),
    alertAdmins: vi.fn(),
    mailerConfigured: vi.fn(),
    createAndSendOtp: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/licenseDefinition", () => ({ toLicenseDefinition, computeUpgradable }));
vi.mock("@/lib/brand", () => ({ sanitizeBrand }));
vi.mock("@/lib/secretBox", () => ({ generateAdminPassword, encryptSecret }));
vi.mock("@/lib/integrations", () => ({ buildIntegrationEnv }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/serverHealth", () => ({
    evaluateServerHealth,
    formatHealth: () => "HEALTH",
    creationBlockedMessage: () => "blocked-please-contact-support",
    healthBlockAlertBody: () => "block-body",
}));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "+20100000000" }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured }));
vi.mock("@/lib/emailOtp", () => ({ createAndSendOtp }));

import { POST } from "@/app/api/academies/route";

const USER = { id: "user-1", role: "client", email: "o@x.com", name: "Owner" };
const PAID = { key: "basic", price: 100, priceEgp: 5000, durationDays: 365, name: "Basic" };

const GH_REF = { ok: true, status: 200, json: async () => ({ object: { sha: "basesha" } }), text: async () => "" };
const GH_BRANCH_OK = { ok: true, status: 201, json: async () => ({}), text: async () => "" };

let ipN = 0;
function post(body: unknown) {
    const req = new Request("http://localhost/api/academies", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ipN}` },
    });
    return POST(req as any);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = "ghtok";
    delete process.env.PROVISION_URL;   // triggerProvision no-ops → no provision fetch
    delete process.env.PROVISION_SECRET;

    getCurrentUser.mockResolvedValue(USER);
    db.license.findFirst.mockResolvedValue(PAID);
    db.license.findMany.mockResolvedValue([]);
    db.platformSetting.findMany.mockResolvedValue([]);
    db.platformSetting.findUnique.mockResolvedValue(null);
    db.academy.findUnique.mockResolvedValue(null);
    db.academy.count.mockResolvedValue(0);
    db.academy.create.mockResolvedValue({ slug: "acme", branch: "client/acme" });
    db.user.findUnique.mockResolvedValue({ emailVerified: true, name: "Owner" });
    mailerConfigured.mockReturnValue(true);
    createAndSendOtp.mockResolvedValue({ ok: true });
    delete process.env.REQUIRE_EMAIL_VERIFICATION; // verified-email gate off by default
    toLicenseDefinition.mockReturnValue("{\"def\":1}");
    computeUpgradable.mockReturnValue(false);
    sanitizeBrand.mockImplementation((b: unknown) => b ?? {});
    generateAdminPassword.mockReturnValue("genpw");
    encryptSecret.mockReturnValue("enc");
    buildIntegrationEnv.mockResolvedValue({});
    notifyTelegram.mockResolvedValue(undefined);
    // Health gate passes by default; individual tests override.
    evaluateServerHealth.mockResolvedValue({ ok: true, reachable: true, reason: null, thresholdPct: 20, freePct: 55, health: {} });
    alertAdmins.mockResolvedValue(undefined);

    // GitHub API: 1st call = read base ref, 2nd = create branch.
    fetchMock = vi.fn().mockResolvedValueOnce(GH_REF).mockResolvedValueOnce(GH_BRANCH_OK);
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GITHUB_TOKEN;
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    delete process.env.ACADEMIES_DAILY_IP_LIMIT;
});

describe("POST /api/academies", () => {
    it("honeypot: returns fake success and touches nothing", async () => {
        const res = await post({ name: "A", slug: "acme", _hp: "bot" });
        expect(res.status).toBe(201);
        expect(getCurrentUser).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("401 when not signed in", async () => {
        getCurrentUser.mockResolvedValue(null);
        expect((await post({ name: "A", slug: "acme" })).status).toBe(401);
    });

    it("400 when the name is empty", async () => {
        const res = await post({ name: "  ", slug: "acme", tier: "basic" });
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("400 on an invalid slug", async () => {
        const res = await post({ name: "Acme", slug: "Bad Slug!", tier: "basic" });
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("500 when GITHUB_TOKEN is not configured", async () => {
        delete process.env.GITHUB_TOKEN;
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(500);
    });

    it("503 + support message when server B fails the health gate (no branch, admins alerted)", async () => {
        evaluateServerHealth.mockResolvedValue({ ok: false, reachable: false, reason: "unreachable", thresholdPct: 20, freePct: null, health: null });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body).toMatchObject({ errorcode: "server_unhealthy", reason: "unreachable", support_whatsapp: "+20100000000" });
        expect(fetchMock).not.toHaveBeenCalled();      // never touched GitHub
        expect(db.academy.create).not.toHaveBeenCalled(); // nothing recorded
        expect(alertAdmins).toHaveBeenCalled();          // admins notified of the block
    });

    it("announces the new academy to admins (with health) on success", async () => {
        await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(alertAdmins).toHaveBeenCalledWith(expect.stringContaining("acme"), "HEALTH");
    });

    it("409 when the slug already exists", async () => {
        db.academy.findUnique.mockResolvedValue({ slug: "acme" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(409);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("403 when the free-academy quota is reached", async () => {
        db.license.findFirst.mockResolvedValue({ key: "demo", price: 0, durationDays: 14, name: "Demo" });
        db.platformSetting.findUnique.mockResolvedValue({ value: "1" }); // free_academy_limit = 1
        db.license.findMany.mockResolvedValue([{ key: "demo" }]);
        db.academy.count.mockResolvedValue(1); // already owns 1 free
        const res = await post({ name: "Demo", slug: "demo1", tier: "demo" });
        expect(res.status).toBe(403);
        expect(db.academy.create).not.toHaveBeenCalled();
    });

    it("403 (email_unverified) when verification is required and the owner isn't verified", async () => {
        process.env.REQUIRE_EMAIL_VERIFICATION = "1";
        db.user.findUnique.mockResolvedValue({ emailVerified: false, name: "Owner" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body).toMatchObject({ errorcode: "email_unverified", needsVerify: true, email: "o@x.com" });
        expect(createAndSendOtp).toHaveBeenCalledWith("o@x.com", "verify", expect.any(Object));
        expect(fetchMock).not.toHaveBeenCalled();      // never touched GitHub
        expect(db.academy.create).not.toHaveBeenCalled();
    });

    it("proceeds when verification is required but the owner IS verified", async () => {
        process.env.REQUIRE_EMAIL_VERIFICATION = "1";
        db.user.findUnique.mockResolvedValue({ emailVerified: true, name: "Owner" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(201);
        expect(createAndSendOtp).not.toHaveBeenCalled();
    });

    it("gate is skipped when REQUIRE_EMAIL_VERIFICATION is off (unverified owner still creates)", async () => {
        db.user.findUnique.mockResolvedValue({ emailVerified: false, name: "Owner" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(201);
        expect(db.user.findUnique).not.toHaveBeenCalled(); // never even looked it up
    });

    it("429 (daily_ip_limit) on the 2nd create from the same IP when the cap is 1", async () => {
        process.env.ACADEMIES_DAILY_IP_LIMIT = "1";
        const ip = "203.0.113.7";
        const call = () => POST(new Request("http://localhost/api/academies", {
            method: "POST",
            body: JSON.stringify({ name: "Acme", slug: "day1", tier: "basic" }),
            headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        }) as any);

        const first = await call();
        expect(first.status).toBe(201);         // under the cap

        // Second attempt from the same IP: blocked before provisioning.
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(GH_REF).mockResolvedValueOnce(GH_BRANCH_OK);
        const second = await call();
        expect(second.status).toBe(429);
        expect((await second.json()).errorcode).toBe("daily_ip_limit");
        expect(fetchMock).not.toHaveBeenCalled(); // never provisioned
    });

    it("400 for a contact-sales plan (no branch, no record)", async () => {
        db.license.findFirst.mockResolvedValue({ key: "pro", price: 0, durationDays: 365, name: "Pro", contactSales: true });
        const res = await post({ name: "Acme", slug: "acme", tier: "pro" });
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(db.academy.create).not.toHaveBeenCalled();
    });

    it("creates the branch + control-plane record and returns 201", async () => {
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({ ok: true, slug: "acme", branch: "client/acme" });

        // GitHub: read base ref, then create the client branch.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" });
        expect(fetchMock.mock.calls[1][0]).toContain("/git/refs");

        // Control-plane row: owner, tier, term, encrypted passwords.
        const data = db.academy.create.mock.calls[0][0].data;
        expect(data).toMatchObject({
            name: "Acme", slug: "acme", branch: "client/acme",
            status: "branch_created", tier: "basic", ownerId: "user-1",
            adminPasswordEnc: "enc", nitAdminPasswordEnc: "enc",
        });
        expect(data.subscribedAt).toBeInstanceOf(Date);
        // Paid tier (durationDays 365) → a concrete validUntil ~1y out.
        const yearOut = Date.now() + 365 * 86_400_000;
        expect(Math.abs((data.validUntil as Date).getTime() - yearOut)).toBeLessThan(60_000);
    });

    it("409 when GitHub reports the branch already exists (422)", async () => {
        fetchMock.mockReset();
        fetchMock
            .mockResolvedValueOnce(GH_REF)
            .mockResolvedValueOnce({ ok: false, status: 422, text: async () => "ref exists" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        expect(res.status).toBe(409);
        expect(db.academy.create).not.toHaveBeenCalled();
    });

    it("still returns 201 (persisted:false) if the branch built but the DB write races", async () => {
        db.academy.create.mockRejectedValue({ code: "P2002" });
        const res = await post({ name: "Acme", slug: "acme", tier: "basic" });
        // P2002 = unique slug race → surfaced as 409.
        expect(res.status).toBe(409);
    });
});
