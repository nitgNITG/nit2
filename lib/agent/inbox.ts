// Inbox actions (E7–E10, FR-I2, FR-I3, FR-H3, §13.9). Each loads the
// conversation, checks the staff member may handle its mode, then acts.
import prisma from "@/prisma/client";
import { allowedModes } from "./admin";
import { recordActivity } from "./crm/activity";
import { sendWaText } from "./channels/whatsapp/cloud";
import { relatedConversations } from "./history";
import { apiError, OBJECT_ID } from "./http";
import { release, takeOver } from "./runtime/state";
import type { AgentStaff } from "./security/authorization";

type Loaded = { conv: NonNullable<Awaited<ReturnType<typeof prisma.conversation.findUnique>>>; res?: never } | { conv?: never; res: Response };

/** 404 when missing, 403 when the staff member can't handle its mode. */
export async function loadForStaff(staff: AgentStaff, id: string): Promise<Loaded> {
    if (!OBJECT_ID.test(id)) return { res: apiError(404, "not_found", "Conversation not found.") };
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return { res: apiError(404, "not_found", "Conversation not found.") };
    if (!allowedModes(staff).includes(conv.mode as "sales" | "support")) return { res: apiError(403, "forbidden", "Not allowed.") };
    return { conv };
}

/** E7: every message (tool rows included, already redacted), the lead and the summary. */
export async function conversationDetail(staff: AgentStaff, id: string): Promise<Response> {
    const l = await loadForStaff(staff, id);
    if (l.res) return l.res;
    const [messages, contact, related] = await Promise.all([
        prisma.chatMessage.findMany({ where: { conversationId: l.conv.id }, orderBy: { createdAt: "asc" }, take: 500 }),
        l.conv.contactId ? prisma.contact.findUnique({ where: { id: l.conv.contactId } }) : Promise.resolve(null),
        relatedConversations(l.conv, allowedModes(staff)),
    ]);
    const waWindow = l.conv.channel === "whatsapp" ? await whatsappWindow(l.conv.id) : null;
    const { ipHash: _ip, sessionId: _s, qualification, ...conversation } = l.conv;
    void _ip; void _s;
    return Response.json({
        conversation: { ...conversation, qualification }, messages, contact, summary: l.conv.summary ?? null, related, waWindow,
        viewer: { userId: staff.user.id, isAdmin: staff.isAdmin, canEditLead: staff.isAdmin || staff.permissions.includes("sales") },
    });
}

/** E8: single winner; 409 when another staff member already owns it. */
export async function takeOverConversation(staff: AgentStaff, id: string): Promise<Response> {
    const l = await loadForStaff(staff, id);
    if (l.res) return l.res;
    if (l.conv.status === "human" && l.conv.assignedTo === staff.user.id) {
        return Response.json({ status: "human", assignedTo: staff.user.id }); // already mine
    }
    if (l.conv.status === "closed") return apiError(409, "conversation_closed", "This conversation is closed.");
    const won = await takeOver(l.conv.id, staff.user.id);
    if (!won) return apiError(409, "already_taken", "Another team member already took this conversation.");
    await prisma.chatMessage.create({ data: { conversationId: l.conv.id, role: "system", content: "human_takeover", staffId: staff.user.id } });
    await recordActivity({ event: "HUMAN_TAKEOVER", conversationId: l.conv.id, createdBy: staff.user.id, summary: staff.user.name ?? staff.user.email });
    return Response.json({ status: "human", assignedTo: staff.user.id });
}

/** E9: hand back to the agent — the assigned staff member, or an admin. */
export async function releaseConversation(staff: AgentStaff, id: string): Promise<Response> {
    const l = await loadForStaff(staff, id);
    if (l.res) return l.res;
    if (l.conv.status !== "human") return apiError(409, "not_with_person", "The conversation is not with a person.");
    if (!staff.isAdmin && l.conv.assignedTo !== staff.user.id) return apiError(403, "forbidden", "Only the assigned team member can hand it back.");
    if (!(await release(l.conv.id, staff.user.id, staff.isAdmin))) return apiError(409, "state_changed", "The conversation changed meanwhile.");
    await prisma.chatMessage.create({ data: { conversationId: l.conv.id, role: "system", content: "released_to_agent", staffId: staff.user.id } });
    return Response.json({ status: "open" });
}

/** E10: staff reply; requires taking over first (the agent must not answer at the same time). */
export async function staffReply(staff: AgentStaff, id: string, content: string): Promise<Response> {
    const l = await loadForStaff(staff, id);
    if (l.res) return l.res;
    if (l.conv.status !== "human") return apiError(409, "take_over_first", "Take over the conversation before replying.");
    if (!staff.isAdmin && l.conv.assignedTo !== staff.user.id) return apiError(403, "forbidden", "Another team member owns this conversation.");
    // WhatsApp (FR-WA3): free-form replies only within 24 h of the customer's last message.
    if (l.conv.channel === "whatsapp") {
        const window = await whatsappWindow(l.conv.id);
        if (!window.open) {
            return apiError(409, "whatsapp_window_closed", "WhatsApp only allows replies within 24 hours of the customer's last message. Wait for them to write, or contact them another way.");
        }
    }
    const message = await prisma.chatMessage.create({ data: { conversationId: l.conv.id, role: "staff", content, staffId: staff.user.id } });
    await prisma.conversation.update({ where: { id: l.conv.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });
    // Web: the widget polls E3. WhatsApp: sent now (FR-WA4).
    if (l.conv.channel === "whatsapp" && l.conv.phoneE164) {
        try {
            await sendWaText(l.conv.phoneE164, content);
        } catch (e) {
            const failed = await prisma.chatMessage.update({ where: { id: message.id }, data: { status: "failed" } });
            return apiError(502, "whatsapp_send_failed", `Saved, but WhatsApp did not accept it: ${(e as Error).message}`, { message: failed });
        }
    }
    return Response.json({ message });
}

const WINDOW_MS = 24 * 3600_000;

/** The WhatsApp customer-service window: open until 24 h after the customer's last message. */
export async function whatsappWindow(conversationId: string, now: Date = new Date()): Promise<{ open: boolean; closesAt: string | null }> {
    const last = await prisma.chatMessage.findFirst({
        where: { conversationId, role: "visitor" }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
    });
    if (!last) return { open: false, closesAt: null };
    const closes = new Date(last.createdAt.getTime() + WINDOW_MS);
    return { open: closes > now, closesAt: closes.toISOString() };
}

export type InboxSummary = {
    waiting: number;
    mine: number;
    /** Newest first; the sidebar alerts on ids it has not seen yet. */
    waitingItems: { id: string; mode: string; since: string }[];
};

/** Waiting-for-a-person conversations in this staff member's inboxes, and the ones they own. */
export async function inboxSummary(staff: AgentStaff): Promise<InboxSummary> {
    const modes = allowedModes(staff);
    const [waiting, mine, rows] = await Promise.all([
        prisma.conversation.count({ where: { status: "waiting_human", mode: { in: modes } } }),
        prisma.conversation.count({ where: { status: "human", assignedTo: staff.user.id } }),
        prisma.conversation.findMany({
            where: { status: "waiting_human", mode: { in: modes } },
            orderBy: { lastMessageAt: "desc" }, take: 20, select: { id: true, mode: true, lastMessageAt: true },
        }),
    ]);
    return { waiting, mine, waitingItems: rows.map((r) => ({ id: r.id, mode: r.mode, since: r.lastMessageAt.toISOString() })) };
}
