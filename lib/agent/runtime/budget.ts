// Daily cost budget (NFR-8, §13.17). Before each model call, reserve() atomically
// adds an upper-bound estimate only if committed + estimate stays within the
// budget; settle() then swaps the estimate for the real cost. Parallel turns can
// therefore never overspend by more than one turn's estimate.
import prisma from "@/prisma/client";
import { PRICE_TABLE_VERSION, type TokenUsage } from "../llm/profiles";

export function cairoDate(now: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function ensureDay(date: string): Promise<void> {
    try {
        await prisma.usageDaily.upsert({
            where: { date },
            create: { date, reservedUsd: 0, spentUsd: 0, committedUsd: 0, budgetAlerted: false },
            update: {},
        });
    } catch {
        /* created concurrently by another instance — fine */
    }
}

export type Reservation = { date: string; estimateUsd: number };

/** Atomically reserve `estimateUsd`; null when it would exceed `budgetUsd`. */
export async function reserve(estimateUsd: number, budgetUsd: number, now: Date = new Date()): Promise<Reservation | null> {
    if (budgetUsd <= 0) return null;
    const date = cairoDate(now);
    await ensureDay(date);
    const res = await prisma.usageDaily.updateMany({
        where: { date, committedUsd: { lte: budgetUsd - estimateUsd } },
        data: { reservedUsd: { increment: estimateUsd }, committedUsd: { increment: estimateUsd } },
    });
    return res.count === 1 ? { date, estimateUsd } : null;
}

/** Replace the reservation with the actual cost (0 actual = call failed before usage). */
export async function settle(r: Reservation, actualUsd: number, usage?: TokenUsage): Promise<void> {
    await prisma.usageDaily.updateMany({
        where: { date: r.date },
        data: {
            reservedUsd: { decrement: r.estimateUsd },
            spentUsd: { increment: actualUsd },
            committedUsd: { increment: actualUsd - r.estimateUsd },
            ...(usage
                ? {
                    inputTokens: { increment: usage.inputTokens },
                    outputTokens: { increment: usage.outputTokens },
                    cacheReadTokens: { increment: usage.cacheReadTokens },
                    cacheWriteTokens: { increment: usage.cacheWriteTokens },
                }
                : {}),
            priceTableVersion: PRICE_TABLE_VERSION,
        },
    });
}

/** Is anything left today? (cheap pre-check before a turn; reserve() is the real gate). */
export async function budgetLeft(budgetUsd: number, now: Date = new Date()): Promise<boolean> {
    if (budgetUsd <= 0) return false;
    const row = await prisma.usageDaily.findUnique({ where: { date: cairoDate(now) } });
    return !row || row.committedUsd < budgetUsd;
}

/** True exactly once per day — the caller sends the single admin alert (AC-09.3). */
export async function claimBudgetAlert(now: Date = new Date()): Promise<boolean> {
    const date = cairoDate(now);
    await ensureDay(date);
    const res = await prisma.usageDaily.updateMany({ where: { date, budgetAlerted: false }, data: { budgetAlerted: true } });
    return res.count === 1;
}
