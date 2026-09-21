// Server-B (academies host) health: fetch the snapshot from the provisioning
// service, decide whether it's safe to create a new academy, and format it for
// Telegram / email / the dashboard.
//
// The gate (per product decision): BLOCK a new academy when server B is
// unreachable OR the academies volume's free disk % is below a configurable
// threshold. Every other metric (memory, load, failed services, docker) is
// reported everywhere but does NOT block.
import prisma from "@/lib/prismaMysql";

export type ServerHealth = {
    disk: { path: string; total_bytes: number; used_bytes: number; free_bytes: number; used_pct: number; free_pct: number };
    memory: { total_bytes: number; available_bytes: number; used_pct: number };
    cpu: { count: number; load1: number; load5: number; load15: number; load1_per_core: number };
    uptime_seconds: number;
    docker: { running: number; mariadb_up: boolean };
    failed_services: string[];
    generated_at: number;
};

export type HealthVerdict = {
    ok: boolean;                 // safe to create a new academy?
    reachable: boolean;          // did server B answer?
    reason: string | null;       // machine reason when !ok: "unreachable" | "low_disk"
    thresholdPct: number;        // configured minimum free %
    freePct: number | null;      // measured free % (null when unreachable)
    health: ServerHealth | null; // full snapshot (null when unreachable)
};

const MIN_FREE_KEY = "server_min_free_pct";
export const DEFAULT_MIN_FREE_PCT = 20;

/** Configured minimum free-disk %. PlatformSetting → env → default 20. Clamped 0–99. */
export async function serverMinFreePct(): Promise<number> {
    let raw = "";
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key: MIN_FREE_KEY } });
        raw = row?.value ?? "";
    } catch { /* control-plane DB unreachable → fall through to env/default */ }
    if (raw.trim() === "") raw = process.env.SERVER_MIN_FREE_PCT ?? "";
    if (raw.trim() === "") return DEFAULT_MIN_FREE_PCT; // blank → default (Number("") is 0, not NaN)
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n < 0 || n > 99) return DEFAULT_MIN_FREE_PCT;
    return n;
}

/** Fetch the host health snapshot from server B. null = unreachable/misconfigured. */
export async function fetchServerHealth(): Promise<ServerHealth | null> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return null;
    try {
        const url = new URL(base);
        url.pathname = "/health";
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url.toString(), {
            headers: { "X-Provision-Secret": secret },
            cache: "no-store",
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        return (await res.json()) as ServerHealth;
    } catch (e) {
        console.error("[serverHealth] fetch failed", e);
        return null;
    }
}

/** True when a provisioning service is configured (so the health gate applies). */
export function provisioningConfigured(): boolean {
    return !!process.env.PROVISION_URL && !!process.env.PROVISION_SECRET;
}

/** Decide whether a new academy may be created right now. */
export async function evaluateServerHealth(): Promise<HealthVerdict> {
    const thresholdPct = await serverMinFreePct();
    // No provisioning service wired → the gate doesn't apply (branch + record are
    // still made, and triggerProvision no-ops), so don't block.
    if (!provisioningConfigured()) {
        return { ok: true, reachable: false, reason: "gate_disabled", thresholdPct, freePct: null, health: null };
    }
    const health = await fetchServerHealth();
    if (!health) {
        return { ok: false, reachable: false, reason: "unreachable", thresholdPct, freePct: null, health: null };
    }
    const freePct = health.disk?.free_pct ?? 0;
    if (freePct < thresholdPct) {
        return { ok: false, reachable: true, reason: "low_disk", thresholdPct, freePct, health };
    }
    return { ok: true, reachable: true, reason: null, thresholdPct, freePct, health };
}

function gb(bytes: number): string {
    return (bytes / 1_073_741_824).toFixed(1) + " GB";
}

function fmtUptime(sec: number): string {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

/** Bilingual user-facing message when creation is blocked by the health gate. */
export function creationBlockedMessage(): string {
    return "عذراً، لا يمكن إنشاء منصة جديدة الآن. برجاء التواصل مع الدعم. " +
        "/ We can’t create a new academy right now — please contact support.";
}

/** Admin-facing body explaining WHY creation was blocked, plus the full snapshot. */
export function healthBlockAlertBody(v: HealthVerdict): string {
    const head = v.reason === "unreachable"
        ? "Reason: server B (academies host) is UNREACHABLE."
        : `Reason: low disk — ${v.freePct}% free, minimum allowed is ${v.thresholdPct}%.`;
    return `${head}\n\n${formatHealth(v.health)}`;
}

/** Compact multi-line health summary for Telegram / email bodies. */
export function formatHealth(health: ServerHealth | null, label = "Server B health (academies host)"): string {
    if (!health) return `${label}: ❌ unreachable`;
    // Tolerant of a partial snapshot: the store provisioner reports the same
    // shape but may omit optional fields (failed_services, uptime, load5/15).
    const d = health.disk, m = health.memory, c = health.cpu;
    const failed = Array.isArray(health.failed_services) ? health.failed_services : [];
    const lines = [
        `🖥️ ${label}`,
        d ? `• Disk: ${d.free_pct}% free (${gb(d.free_bytes)} of ${gb(d.total_bytes)})` : "• Disk: n/a",
        m ? `• Memory: ${m.used_pct}% used (${gb(m.available_bytes)} free)` : "• Memory: n/a",
        c ? `• Load: ${c.load1} / ${c.count} cores (${c.load1_per_core}/core)` : "• Load: n/a",
        health.docker ? `• Docker: ${health.docker.running} running · MariaDB ${health.docker.mariadb_up ? "up ✅" : "DOWN ❌"}` : "• Docker: n/a",
        `• Failed services: ${failed.length ? "⚠️ " + failed.join(", ") : "none ✅"}`,
        typeof health.uptime_seconds === "number" ? `• Uptime: ${fmtUptime(health.uptime_seconds)}` : "",
    ].filter(Boolean);
    return lines.join("\n");
}
