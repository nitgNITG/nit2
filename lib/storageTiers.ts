// Per-tier moodledata storage allowance (GB). MUST stay in sync with the caps in
// provisioning/saas-quota.sh (the hourly enforcer). The provisioning /usage
// endpoint returns raw bytes per academy; the dashboard turns bytes → used/cap
// bar using this map + the tier already stored on each academy row.

export const STORAGE_TIER_GB: Record<string, number> = {
    demo: 1,
    basic: 5,
    standard: 20,
    professional: 100,
};

export function storageCapGb(tier: string | null | undefined): number {
    return STORAGE_TIER_GB[(tier ?? "").toLowerCase()] ?? STORAGE_TIER_GB.demo;
}

/** Human-readable bytes (e.g. 41 MB, 1.2 GB). */
export function formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const val = bytes / Math.pow(1024, i);
    return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1)} ${units[i]}`;
}

export type StorageInfo = {
    usedBytes: number;
    capBytes: number;
    capGb: number;
    pct: number;              // 0..100+ (can exceed 100 when over quota)
    status: "ok" | "warn" | "over";
};

// Pass the academy's actual cap in GB (from its licence's storageGb). When it's
// missing (older licence row without the field), fall back to the tier default.
export function storageInfo(usedBytes: number, capGbOrTier: number | string | null | undefined): StorageInfo {
    const capGb = typeof capGbOrTier === "number" && capGbOrTier > 0
        ? capGbOrTier
        : storageCapGb(typeof capGbOrTier === "string" ? capGbOrTier : undefined);
    const capBytes = capGb * 1024 * 1024 * 1024;
    const pct = capBytes > 0 ? Math.round((usedBytes * 100) / capBytes) : 0;
    const status: StorageInfo["status"] = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
    return { usedBytes, capBytes, capGb, pct, status };
}
