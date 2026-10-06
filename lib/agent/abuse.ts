// Abuse monitor for AI Settings: today's rejected chat requests per rule, the
// IPs blocked most and the busiest visitors (from the rate-limit counters).
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { ABUSE_RULES, DAY_MS, type AbuseRule } from "./security/rate-limit";

export type AbuseStats = {
    since: string; // start of the current UTC day
    blocked: Record<AbuseRule, number>;
    topBlockedIps: { ip: string; count: number }[];
    topVisitors: { visitor: string; kind: "user" | "guest" | "ip"; messages: number }[];
};

/** Today's (UTC) rejected requests per rule, the IPs blocked most, and the busiest visitors. */
export async function abuseStats(now: Date = new Date()): Promise<AbuseStats> {
    const windowStart = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
    const [blockedRows, visitorRows] = await Promise.all([
        prisma.rateLimitBucket.findMany({ where: { windowStart, key: { startsWith: "blocked:" } } }),
        prisma.rateLimitBucket.findMany({ where: { windowStart, key: { startsWith: "visitor:msg:" } }, orderBy: { count: "desc" }, take: 10 }),
    ]);
    const blocked = Object.fromEntries(ABUSE_RULES.map((r) => [r, blockedRows.find((b) => b.key === `blocked:${r}`)?.count ?? 0])) as Record<AbuseRule, number>;
    const topBlockedIps = blockedRows
        .filter((b) => b.key.startsWith("blocked:ip:"))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((b) => ({ ip: `#${b.key.slice("blocked:ip:".length, "blocked:ip:".length + 8)}`, count: b.count }));
    const userIds = visitorRows.map((v) => v.key.slice("visitor:msg:".length)).filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
    const users = userIds.length ? await mysql.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
    const topVisitors = visitorRows.map((v) => {
        const k = v.key.slice("visitor:msg:".length);
        const id = k.slice(k.indexOf(":") + 1);
        if (k.startsWith("u:")) {
            const u = users.find((x) => x.id === id);
            return { visitor: u?.name || u?.email || "Signed-in user", kind: "user" as const, messages: v.count };
        }
        if (k.startsWith("s:")) return { visitor: `Guest #${id.slice(-6)}`, kind: "guest" as const, messages: v.count };
        return { visitor: `IP #${id.slice(0, 8)}`, kind: "ip" as const, messages: v.count };
    });
    return { since: windowStart.toISOString(), blocked, topBlockedIps, topVisitors };
}
