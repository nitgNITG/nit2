// CRM timeline (FR-I4, §13.12): conversation-level events on the lead (Contact),
// shown in Dashboard → Contacts and in the AI Inbox lead panel. Best-effort — a
// failure here never breaks the action it records.
import prisma from "@/prisma/client";

export const ACTIVITY_EVENTS = [
    "AI_CONVERSATION_STARTED", "AI_LEAD_QUALIFIED", "AI_HANDOFF", "HUMAN_TAKEOVER", "AI_FOLLOWUP_APPROVED",
] as const;
export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

/** Recorded at most once per conversation; the others are recorded every time they happen. */
const ONCE: ActivityEvent[] = ["AI_CONVERSATION_STARTED", "AI_LEAD_QUALIFIED"];

export async function recordActivity(input: {
    event: ActivityEvent;
    conversationId: string;
    createdBy: string; // "AI" or staff User.id
    summary?: string | null;
    at?: Date;
}): Promise<boolean> {
    try {
        const conv = await prisma.conversation.findUnique({ where: { id: input.conversationId }, select: { contactId: true, channel: true } });
        if (!conv?.contactId) return false; // no lead yet — backfilled when the lead is created
        if (ONCE.includes(input.event)) {
            const done = await prisma.activity.findFirst({ where: { conversationId: input.conversationId, event: input.event } });
            if (done) return false;
        }
        const lead = await prisma.contact.findUnique({ where: { id: conv.contactId }, select: { score: true, tier: true } });
        await prisma.activity.create({
            data: {
                contactId: conv.contactId, conversationId: input.conversationId, type: "chat", event: input.event,
                channel: conv.channel ?? "web", score: lead?.score ?? null, tier: lead?.tier ?? null,
                summary: input.summary?.slice(0, 500) ?? null, createdBy: input.createdBy,
                ...(input.at ? { createdAt: input.at } : {}),
            },
        });
        return true;
    } catch (e) {
        console.error("[agent] activity not recorded", input.event, (e as Error).message);
        return false;
    }
}

/**
 * When a conversation first gets its lead: record "started", then backfill any
 * handoff / takeover that happened before the visitor left their details.
 */
export async function recordLeadLinked(conversationId: string): Promise<void> {
    await recordActivity({ event: "AI_CONVERSATION_STARTED", conversationId, createdBy: "AI" });
    try {
        const earlier = await prisma.chatMessage.findMany({
            where: { conversationId, role: "system", OR: [{ content: { startsWith: "handoff:" } }, { content: "human_takeover" }] },
            orderBy: { createdAt: "asc" },
        });
        for (const m of earlier) {
            const takeover = m.content === "human_takeover";
            await recordActivity({
                event: takeover ? "HUMAN_TAKEOVER" : "AI_HANDOFF", conversationId,
                createdBy: takeover ? m.staffId ?? "staff" : "AI",
                summary: takeover ? null : m.content.replace(/^handoff:\s*/, ""), at: m.createdAt,
            });
        }
    } catch (e) {
        console.error("[agent] activity backfill failed", (e as Error).message);
    }
}
