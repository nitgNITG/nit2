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

export function toLicenseDefinition(lic: LicenseRow): string {
    const feats = (lic.features && typeof lic.features === "object") ? (lic.features as Record<string, boolean>) : {}
    const features = Object.keys(feats).filter((k) => feats[k])
    return JSON.stringify({
        name: lic.name,
        maxcourses: lic.maxCourses,
        maxteachers: lic.maxTeachers,
        storagegb: lic.storageGb,
        supportedapp: lic.supportedApp,
        videosource: lic.videoSource,
        durationdays: lic.durationDays,
        features,
        limits: (lic.limits && typeof lic.limits === "object") ? lic.limits : { quiz: -1, video: -1, pdf: -1, default: -1 },
    })
}
