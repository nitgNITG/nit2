import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { redact, redactText, REDACTED } from "@/lib/agent/security/redaction";
import { signSessionId, verifySessionCookie } from "@/lib/agent/security/visitor-session";
import { hit } from "@/lib/agent/security/rate-limit";
import { can, getAgentStaff, requireCapability, type Capability } from "@/lib/agent/security/authorization";
import { isTenderRequest } from "@/lib/agent/runtime/state";
import { leadAlertBody } from "@/lib/agent/alerts";

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    process.env.SECRET_JWT = "test-secret-at-least-32-characters-long";
    getCurrentUser.mockReset();
});

describe("redaction (NFR-22, TS-47)", () => {
    it("masks secrets by key and PII inside strings", () => {
        const out = redact({
            card: "4111 1111 1111 1111",
            otp: "123456",
            accessToken: "abc",
            nested: { password: "p", note: "mail me at ahmed@acme.com or +20 100 123 4567, card 4111111111111111" },
            code: "999999",
        });
        expect(out.card).toBe(REDACTED);
        expect(out.otp).toBe(REDACTED);
        expect(out.accessToken).toBe(REDACTED);
        expect(out.code).toBe(REDACTED);
        expect(out.nested.password).toBe(REDACTED);
        expect(out.nested.note).not.toContain("ahmed@acme.com");
        expect(out.nested.note).not.toContain("4111111111111111");
        expect(out.nested.note).not.toContain("123 4567");
        expect(out.nested.note).toContain("a***@acme.com");
    });

    it("removes bearer tokens and API keys from free text", () => {
        expect(redactText("key sk-ant-abcdefghijk and Bearer eyJabc.def.ghi")).not.toMatch(/sk-ant|eyJ/);
    });

    it("lead alerts carry only allow-listed business fields", () => {
        const body = leadAlertBody({
            conversationId: "c1", tier: "HOT", score: 90, country: "sa", service: "lms", budget: "above50k",
            expectedUsers: 20000, mobileApps: true, videoProtection: true, timeline: "1to3months",
            brief: "Call Ahmed at +966 50 123 4567, email ahmed@acme.com", nextAction: "CALL_TODAY",
            // extra fields a caller might pass by mistake are ignored by the template
            ...({ phone: "+966501234567", email: "ahmed@acme.com", card: "4111111111111111" } as object),
        });
        expect(body).toContain("Tier: HOT");
        expect(body).toContain("Expected users: 20000");
        expect(body).toContain("/en/dashboard/conversations/c1");
        expect(body).not.toMatch(/ahmed@acme\.com|\+966501234567|4111111111111111|123 4567/);
    });
});

describe("visitor session cookie (NFR-20)", () => {
    it("verifies its own signature and rejects forgeries", () => {
        const id = "a".repeat(24);
        const signed = signSessionId(id)!;
        expect(verifySessionCookie(signed)).toBe(id);
        expect(verifySessionCookie(`${"b".repeat(24)}.${signed.split(".")[1]}`)).toBeNull();
        expect(verifySessionCookie(`${id}.forged`)).toBeNull();
        expect(verifySessionCookie(id)).toBeNull();
        expect(verifySessionCookie(null)).toBeNull();
    });

    it("a cookie signed with another secret is rejected", () => {
        const signed = signSessionId("c".repeat(24))!;
        process.env.SECRET_JWT = "another-secret-also-32-characters-long!";
        expect(verifySessionCookie(signed)).toBeNull();
    });
});

describe("shared rate limit (NFR-6, TS-06)", () => {
    it("allows 20 messages per window and refuses the 21st; a new window starts fresh", async () => {
        const t = new Date("2026-10-05T10:01:00Z");
        for (let i = 0; i < 20; i++) expect((await hit("ip:msg:x", 20, 600_000, t)).allowed).toBe(true);
        expect((await hit("ip:msg:x", 20, 600_000, t)).allowed).toBe(false);
        expect((await hit("ip:msg:y", 20, 600_000, t)).allowed).toBe(true); // other key unaffected
        expect((await hit("ip:msg:x", 20, 600_000, new Date("2026-10-05T10:11:00Z"))).allowed).toBe(true);
    });
});

describe("tender keyword check (FR-H5, TS-52)", () => {
    it("flags tenders / RFPs in Arabic and English, not normal sentences", () => {
        expect(isTenderRequest("عندنا مناقصة لمنصة تعليمية")).toBe(true);
        expect(isTenderRequest("ممكن ترسلوا كراسة الشروط؟")).toBe(true);
        expect(isTenderRequest("We have an RFP for an LMS")).toBe(true);
        expect(isTenderRequest("Please respond to our tender")).toBe(true);
        expect(isTenderRequest("I want an academy for 200 courses")).toBe(false);
        expect(isTenderRequest("عايز أعمل منصة تعليمية")).toBe(false);
    });
});

describe("agent permissions matrix (§13.14, TS-46 at the library level)", () => {
    const caps: Capability[] = ["conversations:sales", "conversations:support", "leads", "price_ranges", "meetings", "tickets", "analytics", "settings", "staff", "drafts"];
    const allowed = (perms: string[]) => caps.filter((c) => can({ user: { id: "u", email: "", name: null, role: "client" }, isAdmin: false, permissions: perms as never }, c));

    it("matches the matrix for each permission", () => {
        expect(allowed(["sales"])).toEqual(["conversations:sales", "leads", "price_ranges", "meetings", "analytics", "drafts"]);
        expect(allowed(["support"])).toEqual(["conversations:support", "tickets"]);
        expect(allowed(["viewer"])).toEqual(["analytics"]);
        expect(allowed([])).toEqual([]);
    });

    it("admin has everything; a client without permissions has nothing; permissions are read from MySQL each time", async () => {
        getCurrentUser.mockResolvedValue({ id: "adm", email: "a@x", name: null, role: "admin" });
        expect((await requireCapability("settings")).ok).toBe(true);

        await mysql.user.create({ data: { id: "mona", email: "mona@x", password: "h", role: "client", agentPermissions: ["sales"] } });
        getCurrentUser.mockResolvedValue({ id: "mona", email: "mona@x", name: null, role: "client" });
        expect((await requireCapability("price_ranges")).ok).toBe(true);
        expect(await requireCapability("settings")).toEqual({ ok: false, status: 403 });
        expect(await requireCapability("conversations:support")).toEqual({ ok: false, status: 403 });

        await mysql.user.update({ where: { id: "mona" }, data: { agentPermissions: null } });
        expect(await requireCapability("price_ranges")).toEqual({ ok: false, status: 403 });
        expect((await getAgentStaff())!.permissions).toEqual([]);

        getCurrentUser.mockResolvedValue(null);
        expect(await requireCapability("analytics")).toEqual({ ok: false, status: 401 });
    });

    it("ignores unknown permission strings", async () => {
        await mysql.user.create({ data: { id: "eve", email: "eve@x", password: "h", agentPermissions: ["admin", "viewer"] } });
        getCurrentUser.mockResolvedValue({ id: "eve", email: "eve@x", name: null, role: "client" });
        expect((await getAgentStaff())!.permissions).toEqual(["viewer"]);
    });
});
