// Usage report (E13, FR-C3, AC-14.1): per Africa/Cairo day — conversations,
// leads, HOT leads, handoffs, ratings, tokens and estimated cost.
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { cairoDate } from "./runtime/budget";
import { zonedToUtc } from "./runtime/hours";

export type UsageDay = {
    date: string; conversations: number; leads: number; hotLeads: number; handoffs: number;
    thumbsUp: number; thumbsDown: number; tokensIn: number; tokensOut: number; costUsd: number;
};

function datesBetween(from: string, to: string): string[] {
    const out: string[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
        out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
}

/** [from 00:00, day after `to` 00:00) in Africa/Cairo, as UTC instants. */
function cairoRange(from: string, to: string) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const last = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000);
    return {
        gte: zonedToUtc(fy, fm, fd, 0, 0, "Africa/Cairo"),
        lt: zonedToUtc(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate(), 0, 0, "Africa/Cairo"),
    };
}

export async function usageReport(from: string, to: string): Promise<UsageDay[]> {
    const dates = datesBetween(from, to);
    const range = cairoRange(from, to);

    const [convs, leads, handoffs, usage] = await Promise.all([
        prisma.conversation.findMany({ where: { createdAt: range }, select: { createdAt: true, rating: true } }),
        prisma.contact.findMany({ where: { createdAt: range, sourcePage: { in: ["chat", "whatsapp"] } }, select: { createdAt: true, tier: true } }),
        prisma.chatMessage.findMany({ where: { createdAt: range, role: "system", content: { startsWith: "handoff:" } }, select: { createdAt: true } }),
        prisma.usageDaily.findMany({ where: { date: { in: dates } } }),
    ]);

    const days = new Map<string, UsageDay>(dates.map((date) => [date, {
        date, conversations: 0, leads: 0, hotLeads: 0, handoffs: 0, thumbsUp: 0, thumbsDown: 0, tokensIn: 0, tokensOut: 0, costUsd: 0,
    }]));
    const at = (d: Date) => days.get(cairoDate(d));
    for (const c of convs) {
        const day = at(c.createdAt);
        if (!day) continue;
        day.conversations++;
        if (c.rating === 1) day.thumbsUp++;
        if (c.rating === -1) day.thumbsDown++;
    }
    for (const l of leads) {
        const day = at(l.createdAt);
        if (!day) continue;
        day.leads++;
        if (l.tier === "HOT") day.hotLeads++;
    }
    for (const h of handoffs) { const day = at(h.createdAt); if (day) day.handoffs++; }
    for (const u of usage) {
        const day = days.get(u.date);
        if (!day) continue;
        day.tokensIn = u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens;
        day.tokensOut = u.outputTokens;
        day.costUsd = Math.round(u.spentUsd * 10_000) / 10_000;
    }
    return dates.map((d) => days.get(d)!);
}

// ---- Cost breakdown (from AgentUsageEvent, one row per model call) ----

export type ModelCost = { model: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number };
export type VisitorCost = {
    key: string; kind: "user" | "guest" | "ip"; label: string; detail: string | null;
    conversations: number; messages: number; tokensIn: number; tokensOut: number; costUsd: number;
    lastSeen: string; latestConversationId: string;
};
export type CostBreakdown = {
    models: ModelCost[];
    /** Per UTC day — the Anthropic console groups by UTC, the daily table by Cairo time. */
    utcDays: { date: string; costUsd: number }[];
    visitors: VisitorCost[];
    /** Calls with no conversation (none today; kept so the totals always add up). */
    unattributedUsd: number;
    totalUsd: number;
};

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
const MAX_VISITORS = 100;


/**
 * Cost per model, per UTC day and per visitor. A visitor is the signed-in
 * account when there is one, else the guest browser session; `by: "ip"` groups
 * by the hashed IP instead (raw IPs are never stored).
 */
export async function costBreakdown(from: string, to: string, by: "visitor" | "ip" = "visitor"): Promise<CostBreakdown> {
    const events = await prisma.agentUsageEvent.findMany({
        where: { createdAt: cairoRange(from, to) },
        select: { model: true, conversationId: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true, costUsd: true, createdAt: true },
    });

    const models = new Map<string, ModelCost>();
    const utc = new Map<string, number>();
    const perConv = new Map<string, { costUsd: number; tokensIn: number; tokensOut: number }>();
    let unattributed = 0;
    let total = 0;
    for (const e of events) {
        const tokensIn = e.inputTokens + e.cacheReadTokens + e.cacheWriteTokens;
        const m = models.get(e.model) ?? { model: e.model, calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
        m.calls++; m.tokensIn += tokensIn; m.tokensOut += e.outputTokens; m.costUsd += e.costUsd;
        models.set(e.model, m);
        const day = e.createdAt.toISOString().slice(0, 10);
        utc.set(day, (utc.get(day) ?? 0) + e.costUsd);
        total += e.costUsd;
        if (!e.conversationId) { unattributed += e.costUsd; continue; }
        const c = perConv.get(e.conversationId) ?? { costUsd: 0, tokensIn: 0, tokensOut: 0 };
        c.costUsd += e.costUsd; c.tokensIn += tokensIn; c.tokensOut += e.outputTokens;
        perConv.set(e.conversationId, c);
    }

    const convs = perConv.size
        ? await prisma.conversation.findMany({
            where: { id: { in: Array.from(perConv.keys()) } },
            select: { id: true, userId: true, sessionId: true, ipHash: true, contactId: true, messageCount: true, lastMessageAt: true },
        })
        : [];
    const groups = new Map<string, VisitorCost & { contactIds: Set<string>; userId: string | null }>();
    for (const c of convs) {
        const cost = perConv.get(c.id)!;
        const key = by === "ip"
            ? `ip:${c.ipHash ?? "unknown"}`
            : c.userId ? `user:${c.userId}` : c.sessionId ? `guest:${c.sessionId}` : `ip:${c.ipHash ?? "unknown"}`;
        const kind: VisitorCost["kind"] = key.startsWith("user:") ? "user" : key.startsWith("guest:") ? "guest" : "ip";
        const g = groups.get(key) ?? {
            key, kind, label: "", detail: null, conversations: 0, messages: 0, tokensIn: 0, tokensOut: 0, costUsd: 0,
            lastSeen: c.lastMessageAt.toISOString(), latestConversationId: c.id, contactIds: new Set<string>(), userId: c.userId ?? null,
        };
        g.conversations++; g.messages += c.messageCount; g.tokensIn += cost.tokensIn; g.tokensOut += cost.tokensOut; g.costUsd += cost.costUsd;
        if (c.lastMessageAt.toISOString() > g.lastSeen) { g.lastSeen = c.lastMessageAt.toISOString(); g.latestConversationId = c.id; }
        if (c.contactId) g.contactIds.add(c.contactId);
        if (!g.userId && c.userId) g.userId = c.userId;
        groups.set(key, g);
    }
    const top = Array.from(groups.values()).sort((a, b) => b.costUsd - a.costUsd).slice(0, MAX_VISITORS);

    // Names: the account for signed-in visitors, else the lead they left (if any).
    const userIds = Array.from(new Set(top.map((g) => g.userId).filter((x): x is string => !!x)));
    const contactIds = Array.from(new Set(top.flatMap((g) => Array.from(g.contactIds))));
    const [users, contacts] = await Promise.all([
        userIds.length ? mysql.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
        contactIds.length ? prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, email: true } }) : [],
    ]);
    const visitors: VisitorCost[] = top.map(({ contactIds: ids, userId, ...g }) => {
        const u = userId ? users.find((x) => x.id === userId) : undefined;
        const lead = contacts.find((x) => ids.has(x.id));
        const hash = g.key.split(":")[1];
        const fallback = g.kind === "ip" ? `IP #${hash.slice(0, 8)}` : g.kind === "guest" ? `Guest #${hash.slice(-6)}` : "Signed-in user";
        return {
            ...g,
            label: u?.name || u?.email || lead?.name || fallback,
            detail: u?.email ?? lead?.email ?? (g.kind === "ip" ? null : fallback),
            costUsd: round4(g.costUsd),
        };
    });

    return {
        models: Array.from(models.values()).map((m) => ({ ...m, costUsd: round4(m.costUsd) })).sort((a, b) => b.costUsd - a.costUsd),
        utcDays: Array.from(utc.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, c]) => ({ date, costUsd: round4(c) })),
        visitors,
        unattributedUsd: round4(unattributed),
        totalUsd: round4(total),
    };
}
