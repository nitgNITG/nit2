// Fixed-window counters in MongoDB (NFR-6) so several app instances agree.
// One bucket per (key, window); the TTL index on expiresAt cleans them up.
import prisma from "@/prisma/client";

export const LIMITS = {
    ipMessages: { limit: 20, windowMs: 10 * 60_000 },
    ipNewConversations: { limit: 5, windowMs: 60 * 60_000 },
} as const;

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
