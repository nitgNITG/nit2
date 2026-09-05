// Shared License validation/shaping — used by the /api/licenses routes and kept
// out of route.ts (which may only export request handlers).

export const KEY_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const VIDEO_SOURCES = ["all", "limited", "youtube", "vimeo", "vdocipher"];

// Build a clean, typed License payload (minus `key`) from a request body.
export function parseLicense(body: any) {
    const int = (v: any, d: number) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
    return {
        name: String(body?.name ?? "").trim(),
        active: body?.active !== false,
        price: Math.max(0, int(body?.price, 0)),
        priceEgp: Math.max(0, int(body?.priceEgp, 0)),
        durationDays: Math.max(0, int(body?.durationDays, 365)),
        maxCourses: int(body?.maxCourses, -1),
        maxTeachers: int(body?.maxTeachers, -1),
        storageGb: Math.max(1, int(body?.storageGb, 1)), // GB; min 1
        supportedApp: body?.supportedApp !== false, // default true; false = no app access (Demo)
        videoSource: VIDEO_SOURCES.includes(body?.videoSource) ? body.videoSource : "all",
        limits: typeof body?.limits === "object" && body.limits ? body.limits : { quiz: -1, video: -1, pdf: -1, default: -1 },
        features: typeof body?.features === "object" && body.features ? body.features : {},
        order: int(body?.order, 0),
    };
}
