// Convert a MySQL License row into the JSON definition local_license expects
// (its keys: name, maxcourses, maxteachers, videosource, durationdays, features
// as an ARRAY of enabled keys, limits as an assoc). Pushed to each academy so
// enforcement reflects the dashboard-edited licence.
export type LicenseRow = {
    name: string
    maxCourses: number
    maxTeachers: number
    storageGb: number
    supportedApp: boolean
    videoSource: string
    durationDays: number
    limits: unknown
    features: unknown
}

export function toLicenseDefinition(
    lic: LicenseRow,
    opts?: { validUntil?: Date | null },
): string {
    const feats = (lic.features && typeof lic.features === "object") ? (lic.features as Record<string, boolean>) : {}
    const features = Object.keys(feats).filter((k) => feats[k])
    const out: Record<string, unknown> = {
        name: lic.name,
        maxcourses: lic.maxCourses,
        maxteachers: lic.maxTeachers,
        storagegb: lic.storageGb,
        supportedapp: lic.supportedApp,
        videosource: lic.videoSource,
        durationdays: lic.durationDays,
        features,
        limits: (lic.limits && typeof lic.limits === "object") ? lic.limits : { quiz: -1, video: -1, pdf: -1, default: -1 },
    }
    // Renew link for the in-academy expiry banner (same nit2 account page for all).
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "")
    if (base) out.renewurl = `${base}/account`
    // Per-academy expiry date (YYYY-MM-DD) → local_license/expirydate, so the
    // academy can show the renewal banner + know when its term ends. Only when a
    // concrete term is provided (create / renewal / plan change); a plain reapply
    // omits it and leaves any existing expiry untouched.
    if (opts?.validUntil) {
        const d = opts.validUntil
        out.expirydate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    }
    return JSON.stringify(out)
}
