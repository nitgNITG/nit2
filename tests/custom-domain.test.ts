import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { resolve4 } = vi.hoisted(() => ({ resolve4: vi.fn() }));
vi.mock("dns", () => ({ promises: { resolve4 } }));

import {
    normalizeDomain, validateDomain, isApex, dnsInstructions, verifyDnsPointsHere,
} from "@/lib/customDomain";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.SAAS_CLIENT_DOMAIN = "academy2026.nitg-eg.com";
    delete process.env.SERVER_PUBLIC_IP;
});
afterEach(() => { delete process.env.SERVER_PUBLIC_IP; });

describe("normalizeDomain", () => {
    it("strips scheme, path, port, trailing dot and lowercases", () => {
        expect(normalizeDomain("  HTTPS://Academy.School.com:443/x ")).toBe("academy.school.com");
        expect(normalizeDomain("school.com.")).toBe("school.com");
    });
});

describe("validateDomain", () => {
    it("accepts a normal domain", () => {
        expect(validateDomain("academy.school.com")).toEqual({ ok: true, domain: "academy.school.com" });
    });
    it("rejects junk, IPs and our own managed subdomains", () => {
        expect(validateDomain("").ok).toBe(false);
        expect(validateDomain("not a domain").ok).toBe(false);
        expect(validateDomain("10.0.0.1").ok).toBe(false);
        expect(validateDomain("acme.academy2026.nitg-eg.com").ok).toBe(false); // ours
        expect(validateDomain("academy2026.nitg-eg.com").ok).toBe(false);
    });
});

describe("isApex", () => {
    it("treats 2-label names as apex and deeper names as subdomains", () => {
        expect(isApex("school.com")).toBe(true);
        expect(isApex("academy.school.com")).toBe(false);
    });
});

describe("dnsInstructions", () => {
    it("subdomain → CNAME to <slug>.<base>", () => {
        const i = dnsInstructions("academy.school.com", "acme");
        expect(i.apex).toBe(false);
        expect(i.record).toEqual({ type: "CNAME", host: "academy.school.com", value: "acme.academy2026.nitg-eg.com" });
    });
    it("apex → A record to the server IP", () => {
        process.env.SERVER_PUBLIC_IP = "203.0.113.9";
        const i = dnsInstructions("school.com", "acme");
        expect(i.apex).toBe(true);
        expect(i.record).toEqual({ type: "A", host: "@", value: "203.0.113.9" });
    });
});

describe("verifyDnsPointsHere", () => {
    it("passes when the domain resolves to the same IP as our subdomain", async () => {
        resolve4.mockImplementation(async (host: string) =>
            host === "acme.academy2026.nitg-eg.com" ? ["203.0.113.9"] : ["203.0.113.9"]);
        const r = await verifyDnsPointsHere("academy.school.com", "acme");
        expect(r.ok).toBe(true);
        expect(r.expected).toContain("203.0.113.9");
    });
    it("fails when the domain resolves elsewhere", async () => {
        resolve4.mockImplementation(async (host: string) =>
            host === "acme.academy2026.nitg-eg.com" ? ["203.0.113.9"] : ["198.51.100.7"]);
        const r = await verifyDnsPointsHere("academy.school.com", "acme");
        expect(r.ok).toBe(false);
        expect(r.detail).toContain("198.51.100.7");
    });
    it("fails (not throws) when the domain doesn't resolve", async () => {
        resolve4.mockImplementation(async (host: string) =>
            host === "acme.academy2026.nitg-eg.com" ? ["203.0.113.9"] : []);
        const r = await verifyDnsPointsHere("academy.school.com", "acme");
        expect(r.ok).toBe(false);
        expect(r.resolved).toEqual([]);
    });
    it("also accepts a configured SERVER_PUBLIC_IP as a valid target", async () => {
        process.env.SERVER_PUBLIC_IP = "203.0.113.9";
        resolve4.mockImplementation(async (host: string) =>
            host === "acme.academy2026.nitg-eg.com" ? [] : ["203.0.113.9"]);
        const r = await verifyDnsPointsHere("academy.school.com", "acme");
        expect(r.ok).toBe(true);
    });
});
