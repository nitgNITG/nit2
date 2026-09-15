// Small readers for control-plane PlatformSetting values that gate runtime
// behaviour (not the app-binary globals in platformKeys.ts). Each reader lets the
// admin-panel value win, falling back to a legacy env var when the row is unset —
// so moving a knob from env to the dashboard is non-breaking.
import prisma from "@/lib/prismaMysql";

/** Raw trimmed value for a key, or null when the row is absent/blank/unreadable. */
export async function readSetting(key: string): Promise<string | null> {
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key } });
        const v = (row?.value ?? "").trim();
        return v === "" ? null : v;
    } catch {
        return null; // DB hiccup → treat as "not set" and let callers fall back
    }
}

/**
 * Boolean setting. The stored value wins ("1"/"true"/"on"/"yes" = true, anything
 * else = false); when the row is unset, falls back to `envVar` (legacy) if given.
 */
export async function settingOn(key: string, envVar?: string): Promise<boolean> {
    const stored = await readSetting(key);
    const raw = stored ?? (envVar ? process.env[envVar] : undefined);
    if (raw == null) return false;
    return ["1", "true", "on", "yes"].includes(raw.trim().toLowerCase());
}

/**
 * Integer setting with a default. The stored value wins; when unset, falls back to
 * `envVar` (legacy), then to `def`. A non-numeric value yields `def`.
 */
export async function settingInt(key: string, def: number, envVar?: string): Promise<number> {
    const stored = await readSetting(key);
    const raw = stored ?? (envVar ? process.env[envVar] : undefined);
    if (raw == null || raw.trim() === "") return def;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : def;
}
