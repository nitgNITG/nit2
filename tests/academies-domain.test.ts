import { describe, it, expect, beforeEach, vi } from "vitest";

const { db, getCurrentUser, verifyDnsPointsHere, triggerBindDomain, triggerUnbindDomain, fetchDomainStatus, alertAdmins } = vi.hoisted(() => ({
    db: { tenant: { findUnique: vi.fn(), update: vi.fn() } },
    getCurrentUser: vi.fn(),
    verifyDnsPointsHere: vi.fn(),
    triggerBindDomain: vi.fn(),
    triggerUnbindDomain: vi.fn(),
    fetchDomainStatus: vi.fn(),
    alertAdmins: vi.fn(),
}));

vi.mock("@/lib/prismaMysql", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/provisionAcademy", () => ({ triggerBindDomain, triggerUnbindDomain, fetchDomainStatus }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins }));
// customDomain: keep validation/instructions real, but stub the network DNS check.
vi.mock("@/lib/customDomain", async (orig) => {
    const actual = await orig<typeof import("@/lib/customDomain")>();
    return { ...actual, verifyDnsPointsHere };
});

import { GET, POST, PUT, DELETE } from "@/app/api/academies/[slug]/domain/route";

const OWNER = { id: "user-1", role: "client" };
const ACADEMY = { slug: "acme", ownerId: "user-1", customDomain: null as string | null, domainStatus: "none", domainError: null as string | null };

function req(method: string, body?: unknown) {
    return new Request(`http://localhost/api/academies/acme/domain`, {
        method, body: body === undefined ? undefined : JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    }) as any;
}
const P = { params: { slug: "acme" } };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.SAAS_CLIENT_DOMAIN = "academy2026.nitg-eg.com";
    getCurrentUser.mockResolvedValue(OWNER);
    db.tenant.findUnique.mockResolvedValue({ ...ACADEMY });
    db.tenant.update.mockImplementation(({ data }: any) => Promise.resolve({ ...ACADEMY, ...data }));
    verifyDnsPointsHere.mockResolvedValue({ ok: true, resolved: ["203.0.113.9"], expected: ["203.0.113.9"], detail: "ok" });
    triggerBindDomain.mockResolvedValue(true);
    triggerUnbindDomain.mockResolvedValue(undefined);
    fetchDomainStatus.mockResolvedValue(null);
    alertAdmins.mockResolvedValue(undefined);
});

describe("domain route — auth", () => {
    it("401 when signed out", async () => {
        getCurrentUser.mockResolvedValue(null);
        expect((await GET(req("GET"), P)).status).toBe(401);
    });
    it("403 when a client is not the owner", async () => {
        getCurrentUser.mockResolvedValue({ id: "intruder", role: "client" });
        expect((await POST(req("POST", { domain: "a.school.com" }), P)).status).toBe(403);
    });
    it("404 when the academy is missing", async () => {
        db.tenant.findUnique.mockResolvedValue(null);
        expect((await GET(req("GET"), P)).status).toBe(404);
    });
});

describe("POST set domain", () => {
    it("saves a valid domain as pending_dns and returns CNAME instructions", async () => {
        const res = await POST(req("POST", { domain: "Academy.School.com/" }), P);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.customDomain).toBe("academy.school.com");
        expect(body.domainStatus).toBe("pending_dns");
        expect(body.instructions.options.find((o: any) => o.type === "CNAME")).toMatchObject({ value: "acme.academy2026.nitg-eg.com", recommended: true });
    });
    it("rejects an invalid domain (400)", async () => {
        expect((await POST(req("POST", { domain: "nope" }), P)).status).toBe(400);
    });
    it("409 when the domain is bound to another academy", async () => {
        db.tenant.findUnique.mockImplementation(({ where }: any) =>
            Promise.resolve(where.customDomain ? { slug: "other" } : { ...ACADEMY }));
        expect((await POST(req("POST", { domain: "a.school.com" }), P)).status).toBe(409);
    });
});

describe("PUT verify + bind", () => {
    beforeEach(() => { db.tenant.findUnique.mockResolvedValue({ ...ACADEMY, customDomain: "academy.school.com", domainStatus: "pending_dns" }); });

    it("400 when no domain is set yet", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...ACADEMY });
        expect((await PUT(req("PUT"), P)).status).toBe(400);
    });
    it("409 when DNS isn't pointing here (no bind triggered)", async () => {
        verifyDnsPointsHere.mockResolvedValue({ ok: false, resolved: ["198.51.100.7"], expected: ["203.0.113.9"], detail: "wrong" });
        const res = await PUT(req("PUT"), P);
        expect(res.status).toBe(409);
        expect(triggerBindDomain).not.toHaveBeenCalled();
        expect((await res.json()).domainStatus).toBe("pending_dns");
    });
    it("verifies, triggers the bind, sets verifying + re-arms Google flag", async () => {
        const res = await PUT(req("PUT"), P);
        expect(res.status).toBe(200);
        expect(triggerBindDomain).toHaveBeenCalledWith("acme", "academy.school.com");
        const data = db.tenant.update.mock.calls[0][0].data;
        expect(data).toMatchObject({ domainStatus: "verifying", domainError: null, googleOauthAdded: false });
        expect(alertAdmins).toHaveBeenCalled();
    });
    it("503 when the provisioning service is unavailable", async () => {
        triggerBindDomain.mockResolvedValue(false);
        expect((await PUT(req("PUT"), P)).status).toBe(503);
    });
});

describe("GET sync while verifying", () => {
    it("promotes to active when server B reports success", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...ACADEMY, customDomain: "academy.school.com", domainStatus: "verifying" });
        fetchDomainStatus.mockResolvedValue({ state: "active", domain: "academy.school.com" });
        const res = await GET(req("GET"), P);
        const body = await res.json();
        expect(body.domainStatus).toBe("active");
        expect(db.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domainStatus: "active" }) }));
    });
    it("marks failed with the error when server B reports failure", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...ACADEMY, customDomain: "academy.school.com", domainStatus: "verifying" });
        fetchDomainStatus.mockResolvedValue({ state: "failed", error: "certbot failed" });
        const body = await (await GET(req("GET"), P)).json();
        expect(body.domainStatus).toBe("failed");
        expect(body.domainError).toBe("certbot failed");
    });
});

describe("DELETE unbind", () => {
    it("clears the domain and tells server B to revert", async () => {
        db.tenant.findUnique.mockResolvedValue({ ...ACADEMY, customDomain: "academy.school.com", domainStatus: "active" });
        const body = await (await DELETE(req("DELETE"), P)).json();
        expect(triggerUnbindDomain).toHaveBeenCalledWith("acme");
        expect(body.customDomain).toBeNull();
        expect(body.domainStatus).toBe("none");
    });
});
