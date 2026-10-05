// Inbox actions (E7–E10, FR-I2, FR-I3, FR-H3, §13.9). Each loads the
// conversation, checks the staff member may handle its mode, then acts.
import prisma from "@/prisma/client";
import { allowedModes } from "./admin";
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
    const [messages, contact] = await Promise.all([
        prisma.chatMessage.findMany({ where: { conversationId: l.conv.id }, orderBy: { createdAt: "asc" }, take: 500 }),
        l.conv.contactId ? prisma.contact.findUnique({ where: { id: l.conv.contactId } }) : Promise.resolve(null),
    ]);
    const { ipHash: _ip, sessionId: _s, qualification, ...conversation } = l.conv;
    void _ip; void _s;
    return Response.json({
        conversation: { ...conversation, qualification }, messages, contact, summary: l.conv.summary ?? null,
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
    const message = await prisma.chatMessage.create({ data: { conversationId: l.conv.id, role: "staff", content, staffId: staff.user.id } });
    await prisma.conversation.update({ where: { id: l.conv.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });
    // Web: the widget polls E3. WhatsApp delivery arrives in phase 3 (FR-WA4).
    return Response.json({ message });
}
