import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { db } = vi.hoisted(() => ({ db: { platformSetting: { findUnique: vi.fn() } } }));
vi.mock("@/lib/prismaMysql", () => ({ default: db }));

import {
    evaluateServerHealth, serverMinFreePct, formatHealth, provisioningConfigured,
    DEFAULT_MIN_FREE_PCT, type ServerHealth,
} from "@/lib/serverHealth";

function health(freePct: number): ServerHealth {
    return {
        disk: { path: "/var/www/html/saas", total_bytes: 100e9, used_bytes: (100 - freePct) * 1e9, free_bytes: freePct * 1e9, used_pct: 100 - freePct, free_pct: freePct },
        memory: { total_bytes: 16e9, available_bytes: 8e9, used_pct: 50 },
        cpu: { count: 4, load1: 1.2, load5: 1.0, load15: 0.8, load1_per_core: 0.3 },
        uptime_seconds: 90000, docker: { running: 12, mariadb_up: true },
        failed_services: [], generated_at: 1,
    };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROVISION_URL = "https://prov.example.com/provision";
    process.env.PROVISION_SECRET = "sek";
    delete process.env.SERVER_MIN_FREE_PCT;
    db.platformSetting.findUnique.mockResolvedValue(null); // → default threshold 20
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.PROVISION_URL; delete process.env.PROVISION_SECRET; });

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("serverMinFreePct", () => {
    it("defaults to 20 when unset/invalid", async () => {
        expect(await serverMinFreePct()).toBe(DEFAULT_MIN_FREE_PCT);
        db.platformSetting.findUnique.mockResolvedValue({ value: "oops" });
        expect(await serverMinFreePct()).toBe(20);
    });
    it("reads the configured value, clamped to 0–99", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "35" });
        expect(await serverMinFreePct()).toBe(35);
        db.platformSetting.findUnique.mockResolvedValue({ value: "250" });
        expect(await serverMinFreePct()).toBe(20); // out of range → default
    });
});

describe("evaluateServerHealth", () => {
    it("blocks when free disk % is below the threshold", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "20" });
        fetchMock.mockResolvedValue(ok(health(12)));
        const v = await evaluateServerHealth();
        expect(v).toMatchObject({ ok: false, reachable: true, reason: "low_disk", freePct: 12, thresholdPct: 20 });
    });

    it("allows when free disk % meets the threshold", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "20" });
        fetchMock.mockResolvedValue(ok(health(45)));
        const v = await evaluateServerHealth();
        expect(v.ok).toBe(true);
        expect(v.reason).toBeNull();
    });

    it("blocks when server B is unreachable (configured but no answer)", async () => {
        fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
        const v = await evaluateServerHealth();
        expect(v).toMatchObject({ ok: false, reachable: false, reason: "unreachable", health: null });
    });

    it("blocks on a non-2xx from server B", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        const v = await evaluateServerHealth();
        expect(v).toMatchObject({ ok: false, reason: "unreachable" });
    });

    it("does NOT block when provisioning isn't configured (gate disabled)", async () => {
        delete process.env.PROVISION_URL;
        const v = await evaluateServerHealth();
        expect(v).toMatchObject({ ok: true, reason: "gate_disabled" });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("boundary: exactly at the threshold is allowed", async () => {
        db.platformSetting.findUnique.mockResolvedValue({ value: "20" });
        fetchMock.mockResolvedValue(ok(health(20)));
        expect((await evaluateServerHealth()).ok).toBe(true);
    });
});

describe("provisioningConfigured", () => {
    it("is true only when both URL and secret are set", () => {
        expect(provisioningConfigured()).toBe(true);
        delete process.env.PROVISION_SECRET;
        expect(provisioningConfigured()).toBe(false);
    });
});

describe("formatHealth", () => {
    it("summarises a snapshot with disk/memory/load/docker/services", () => {
        const s = formatHealth(health(30));
        expect(s).toContain("30% free");
        expect(s).toContain("MariaDB up");
        expect(s).toContain("Failed services: none");
    });
    it("reports unreachable for a null snapshot", () => {
        expect(formatHealth(null)).toContain("unreachable");
    });
});
