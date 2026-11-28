// Server half of lead tracking: validate what /api/track receives, and roll the
// stored LeadEvent rows up for the dashboard. Browser half: lib/leadTracking.ts.
import { LEAD_EVENT_TYPES, type LeadEventType, type LeadPayload } from "@/lib/leadTracking";

export const MAX_TRACK_BODY_BYTES = 2048;
const MAX_PAGE = 300;

const isType = (v: unknown): v is LeadEventType => typeof v === "string" && (LEAD_EVENT_TYPES as readonly string[]).includes(v);
const opt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const HOST = /^[a-z0-9.-]{1,253}$/i;

/** The event to store, or null when the input is not a valid event. Unknown keys are dropped. */
export function parseLeadEvent(raw: unknown): LeadPayload | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (!isType(r.type)) return null;
    if (typeof r.page !== "string" || !r.page.startsWith("/") || r.page.length > MAX_PAGE || /\s/.test(r.page)) return null;
    if (r.locale !== "ar" && r.locale !== "en") return null;
    const host = opt(r.referrerHost, 253);
    const event: LeadPayload = { type: r.type, page: r.page, locale: r.locale };
    const extra = {
        referrerHost: host && HOST.test(host) ? host.toLowerCase() : undefined,
        utmSource: opt(r.utmSource, 100),
        utmMedium: opt(r.utmMedium, 100),
        utmCampaign: opt(r.utmCampaign, 100),
    };
    for (const [k, v] of Object.entries(extra)) if (v) (event as Record<string, string>)[k] = v;
    return event;
}

/** Reads the body, giving up (null) as soon as it passes `max` bytes. */
export async function readCappedBody(req: Request, max = MAX_TRACK_BODY_BYTES): Promise<string | null> {
    if (Number(req.headers.get("content-length") ?? 0) > max) return null;
    if (!req.body) return "";
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel().catch(() => {});
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
}

export type LeadEventRow = { type: string; locale: string; page: string; createdAt: Date };
export type MonthCount = { month: string; type: string; locale: string; count: number };
export type PageCount = { page: string; count: number; byType: Record<string, number> };

/** First instant (UTC) of the month `monthsBack` months before `now`'s month. */
export function monthStartUtc(now: Date, monthsBack = 0): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
}

/** Counts per UTC month x type x locale (newest month first) and the busiest pages. */
export function aggregateLeadEvents(rows: LeadEventRow[], topN = 20) {
    const months = new Map<string, MonthCount>();
    const pages = new Map<string, PageCount>();
    for (const r of rows) {
        const month = new Date(r.createdAt).toISOString().slice(0, 7);
        const key = `${month}|${r.type}|${r.locale}`;
        const m = months.get(key) ?? { month, type: r.type, locale: r.locale, count: 0 };
        m.count++;
        months.set(key, m);
        const p = pages.get(r.page) ?? { page: r.page, count: 0, byType: {} };
        p.count++;
        p.byType[r.type] = (p.byType[r.type] ?? 0) + 1;
        pages.set(r.page, p);
    }
    const byMonth = Array.from(months.values()).sort((a, b) =>
        b.month.localeCompare(a.month) || a.type.localeCompare(b.type) || a.locale.localeCompare(b.locale));
    const topPages = Array.from(pages.values()).sort((a, b) => b.count - a.count || a.page.localeCompare(b.page)).slice(0, topN);
    return { total: rows.length, byMonth, topPages };
}
