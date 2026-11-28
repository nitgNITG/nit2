// Working hours in the configured time zone (FR-H4, D3). Pure; Intl only.

type Parts = { y: number; m: number; d: number; weekday: number; hh: number; mm: number };
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partsIn(ts: number, tz: string): Parts {
    const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hourCycle: "h23", weekday: "short",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const x of fmt.formatToParts(new Date(ts))) p[x.type] = x.value;
    return { y: +p.year, m: +p.month, d: +p.day, weekday: WEEKDAYS[p.weekday], hh: +p.hour % 24, mm: +p.minute };
}

/** Offset of `tz` from UTC at instant ts, in ms (local − UTC). */
function offsetMs(ts: number, tz: string): number {
    const p = partsIn(ts, tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - Math.floor(ts / 60_000) * 60_000;
}

/** The UTC instant of a wall-clock time in `tz`. */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let ts = guess - offsetMs(guess, tz);
    ts = guess - offsetMs(ts, tz); // second pass settles DST edges
    return new Date(ts);
}

const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};

export type WorkingHours = { days: number[]; from: string; to: string; tz: string };

export function workingHoursStatus(wh: WorkingHours, now: Date = new Date()): { open: boolean; nextOpenAt: Date | null } {
    const p = partsIn(now.getTime(), wh.tz);
    const nowMin = p.hh * 60 + p.mm;
    const from = toMin(wh.from);
    const to = toMin(wh.to);
    const open = wh.days.includes(p.weekday) && nowMin >= from && nowMin < to;
    if (open) return { open, nextOpenAt: null };
    for (let k = 0; k <= 7; k++) {
        const day = new Date(Date.UTC(p.y, p.m - 1, p.d + k));
        if (!wh.days.includes(day.getUTCDay())) continue;
        if (k === 0 && nowMin >= from) continue; // today's window already started (and ended)
        return {
            open,
            nextOpenAt: zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(from / 60), from % 60, wh.tz),
        };
    }
    return { open, nextOpenAt: null }; // no working days configured
}

/** "Sunday 10:00" style label in the visitor's language, in the configured tz. */
export function formatNextOpen(at: Date, tz: string, locale: "ar" | "en"): string {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
        timeZone: tz, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(at);
}
