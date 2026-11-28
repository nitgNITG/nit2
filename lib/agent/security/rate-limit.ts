// Fixed-window counters in MongoDB (NFR-6) so several app instances agree.
// One bucket per (key, window); the TTL index on expiresAt cleans them up.
import prisma from "@/prisma/client";

export const DAY_MS = 86_400_000;
export const ABUSE_RULES = ["ip_messages", "ip_new_conversations", "visitor_daily"] as const;
export type AbuseRule = (typeof ABUSE_RULES)[number];

/** Count one hit; `allowed` is false once the window holds more than `limit` hits. */
export async function hit(
    key: string,
    limit: number,
    windowMs: number,
    now: Date = new Date(),
): Promise<{ allowed: boolean; count: number }> {
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const expiresAt = new Date(windowStart.getTime() + windowMs);
    const where = { key_windowStart: { key, windowStart } };
    let row;
    try {
        row = await prisma.rateLimitBucket.upsert({
            where,
            create: { key, windowStart, expiresAt, count: 1 },
            update: { count: { increment: 1 } },
        });
    } catch {
        // Two instances created the bucket at once: the unique index rejected one — just increment.
        row = await prisma.rateLimitBucket.update({ where, data: { count: { increment: 1 } } });
    }
    return { allowed: row.count <= limit, count: row.count };
}

/** The per-visitor counter key: signed-in account, else guest session, else hashed IP. */
export function visitorKey(v: { userId?: string | null; sessionId?: string | null; ipHash: string }): string {
    return v.userId ? `u:${v.userId}` : v.sessionId ? `s:${v.sessionId}` : `ip:${v.ipHash}`;
}

/** Count a rejected request for today's abuse stats (UTC day). Best-effort. */
export async function recordBlocked(rule: AbuseRule, ipHash: string, now: Date = new Date()): Promise<void> {
    try {
        await hit(`blocked:${rule}`, Number.MAX_SAFE_INTEGER, DAY_MS, now);
        await hit(`blocked:ip:${ipHash}`, Number.MAX_SAFE_INTEGER, DAY_MS, now);
    } catch (e) {
        console.error("[agent] abuse stat not recorded", (e as Error).message);
    }
}
