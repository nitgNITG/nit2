// Usage report (E13, FR-C3, AC-14.1): per Africa/Cairo day — conversations,
// leads, HOT leads, handoffs, ratings, tokens and estimated cost.
import prisma from "@/prisma/client";
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

export async function usageReport(from: string, to: string): Promise<UsageDay[]> {
    const dates = datesBetween(from, to);
    const [fy, fm, fd] = from.split("-").map(Number);
    const last = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000);
    const start = zonedToUtc(fy, fm, fd, 0, 0, "Africa/Cairo");
    const end = zonedToUtc(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate(), 0, 0, "Africa/Cairo");
    const range = { gte: start, lt: end };

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
