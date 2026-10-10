// Daily agent housekeeping (E18, NFR-12, §13.16, §13.9). Idempotent:
//  1) close conversations idle for 24 h (any non-closed status), with a summary;
//  2) apply retention per data type. TTL indexes already expire sessions, audit,
//     idempotency and rate-limit rows — the deletes here are the belt to those
//     braces (and cover environments where scripts/agent-indexes.mjs never ran).
// Kept: Contact / consent (CRM policy), tickets, meeting requests.
import prisma from "@/prisma/client";
import { alertFollowUpDrafts } from "./alerts";
import { tagPending } from "./analytics";
import type { AgentConfig } from "./config";
import { createFollowUpDrafts, type DraftRunResult } from "./followups";
import { generateBrief } from "./runtime/brief";
import { cairoDate } from "./runtime/budget";
import { transition } from "./runtime/state";

const DAY = 86_400_000;
export const RETENTION = {
    chatMonths: 12,
    toolAuditDays: 180,
    idempotencyDays: 7,
    sessionDays: 30,
    usageMonths: 24,
} as const;
export const IDLE_CLOSE_MS = DAY;
/** Summaries cost a model call each; bound the work per run. */
export const MAX_SUMMARIES_PER_RUN = 50;

const monthsAgo = (now: Date, n: number) => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d;
};

export type MaintenanceResult = {
    closed: number;
    summarized: number;
    tagged: number; // analytics tags written this run (FR-N1)
    deleted: number;
    deletedBy: { conversations: number; messages: number; toolAudits: number; idempotency: number; sessions: number; rateLimits: number; usageDays: number };
    drafts: number; // phase 4: follow-up drafts created this run (FR-F1, F2, F4)
    draftsBy: DraftRunResult;
};

export async function runDailyMaintenance(cfg: AgentConfig, now: Date = new Date()): Promise<MaintenanceResult> {
    // 1) Idle conversations → closed. Each close is a conditional transition, so a
    //    visitor writing at the same moment simply keeps it open.
    const idle = await prisma.conversation.findMany({
        where: { status: { in: ["open", "waiting_human", "human"] }, lastMessageAt: { lt: new Date(now.getTime() - IDLE_CLOSE_MS) } },
        select: { id: true, messageCount: true, lastMessageAt: true },
        take: 1000,
    });
    let closed = 0;
    let summarized = 0;
    for (const c of idle) {
        const won = await transition(c.id, ["open", "waiting_human", "human"], "closed", {}, { lastMessageAt: c.lastMessageAt });
        if (!won) continue;
        closed++;
        if (c.messageCount >= 2 && summarized < MAX_SUMMARIES_PER_RUN) {
            if (await generateBrief(c.id, cfg)) summarized++;
        }
    }

    // 1b) Analytics tags for finished conversations (bounded per run; cost-capped by the budget).
    const tagged = await tagPending(cfg, MAX_SUMMARIES_PER_RUN);

    // 1c) Follow-up drafts (phase 4). Drafts only — staff approve before anything is sent (FR-F3).
    let draftsBy: DraftRunResult = { due: 0, checkout: 0, abandoned: 0, skipped: 0 };
    try {
        draftsBy = await createFollowUpDrafts(cfg, now);
    } catch (e) {
        console.error("[agent] follow-up drafts failed", (e as Error).message);
    }
    const drafts = draftsBy.due + draftsBy.checkout + draftsBy.abandoned;
    if (drafts > 0) await alertFollowUpDrafts(drafts);

    // 2) Retention.
    const oldChat = monthsAgo(now, RETENTION.chatMonths);
    const expired = await prisma.conversation.findMany({ where: { lastMessageAt: { lt: oldChat } }, select: { id: true }, take: 5000 });
    const ids = expired.map((e) => e.id);
    const messages = ids.length ? (await prisma.chatMessage.deleteMany({ where: { conversationId: { in: ids } } })).count : 0;
    const conversations = ids.length ? (await prisma.conversation.deleteMany({ where: { id: { in: ids } } })).count : 0;
    const toolAudits = (await prisma.toolAudit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION.toolAuditDays * DAY) } } })).count;
    const idempotency = (await prisma.idempotencyRecord.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION.idempotencyDays * DAY) } } })).count;
    const sessions = (await prisma.agentSession.deleteMany({ where: { lastSeenAt: { lt: new Date(now.getTime() - RETENTION.sessionDays * DAY) } } })).count;
    const rateLimits = (await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } })).count;
    const usageDays = (await prisma.usageDaily.deleteMany({ where: { date: { lt: cairoDate(monthsAgo(now, RETENTION.usageMonths)) } } })).count;

    const deletedBy = { conversations, messages, toolAudits, idempotency, sessions, rateLimits, usageDays };
    return {
        closed,
        summarized,
        tagged,
        deleted: Object.values(deletedBy).reduce((a, b) => a + b, 0),
        deletedBy,
        drafts,
        draftsBy,
    };
}
