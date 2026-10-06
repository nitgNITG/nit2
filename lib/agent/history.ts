// Previous chats. Visitor side (widget): the signed-in account's conversations,
// or — for a guest — the ones started from this browser's session cookie, the
// same ownership rule as loadOwnedConversation. Staff side (AI Inbox): the
// same visitor's other conversations, limited to the inboxes the staff member works.
import prisma from "@/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { currentSessionId } from "./security/visitor-session";

export type ChatSummary = { id: string; status: string; mode: string; title: string; messageCount: number; lastMessageAt: string; createdAt: string };

const MAX = 20;

async function titles(ids: string[]): Promise<Map<string, string>> {
    const firsts = await Promise.all(ids.map((id) => prisma.chatMessage.findFirst({
        where: { conversationId: id, role: "visitor", status: "sent" }, orderBy: { createdAt: "asc" }, select: { content: true },
    })));
    return new Map(ids.map((id, i) => {
        const t = (firsts[i]?.content ?? "").replace(/\s+/g, " ").trim();
        return [id, t.length > 80 ? `${t.slice(0, 79)}…` : t];
    }));
}

type Row = { id: string; status: string; mode: string; messageCount: number; lastMessageAt: Date; createdAt: Date };
async function summarize(rows: Row[]): Promise<ChatSummary[]> {
    const t = await titles(rows.map((r) => r.id));
    return rows.map((r) => ({
        id: r.id, status: r.status, mode: r.mode, title: t.get(r.id) ?? "", messageCount: r.messageCount,
        lastMessageAt: r.lastMessageAt.toISOString(), createdAt: r.createdAt.toISOString(),
    }));
}
const SELECT = { id: true, status: true, mode: true, messageCount: true, lastMessageAt: true, createdAt: true } as const;

/** E-history: the visitor's own conversations, newest first. */
export async function visitorConversations(req: Request): Promise<{ scope: "account" | "browser" | "none"; items: ChatSummary[] }> {
    const [user, sessionId] = await Promise.all([getCurrentUser(), currentSessionId(req)]);
    if (!user && !sessionId) return { scope: "none", items: [] };
    // Account chats open only for that account; a session's anonymous chats open for the browser that holds it.
    const or = [
        ...(user ? [{ userId: user.id }] : []),
        ...(sessionId ? [{ sessionId, userId: null }] : []),
    ];
    const rows = await prisma.conversation.findMany({
        where: { OR: or, messageCount: { gt: 0 } }, orderBy: { lastMessageAt: "desc" }, take: MAX, select: SELECT,
    });
    return { scope: user ? "account" : "browser", items: await summarize(rows) };
}

/** The same visitor's other conversations (same account, browser session or lead), for staff. */
export async function relatedConversations(
    conv: { id: string; userId?: string | null; sessionId?: string | null; contactId?: string | null },
    modes: string[],
): Promise<ChatSummary[]> {
    const or = [
        ...(conv.userId ? [{ userId: conv.userId }] : []),
        ...(conv.sessionId ? [{ sessionId: conv.sessionId }] : []),
        ...(conv.contactId ? [{ contactId: conv.contactId }] : []),
    ];
    if (!or.length || !modes.length) return [];
    const rows = await prisma.conversation.findMany({
        where: { OR: or, id: { not: conv.id }, mode: { in: modes } }, orderBy: { lastMessageAt: "desc" }, take: MAX, select: SELECT,
    });
    return summarize(rows);
}
