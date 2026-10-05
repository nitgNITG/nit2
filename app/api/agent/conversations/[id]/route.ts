// E3 — GET /api/agent/conversations/[id]?after=<messageId> (conversation owner).
// Visitor-visible history only: roles visitor, assistant, staff — never tool rows.
import prisma from "@/prisma/client";
import { apiError, loadOwnedConversation, OBJECT_ID } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const conv = await loadOwnedConversation(req, params.id);
    if (!conv) return apiError(404, "conversation_not_found", "Conversation not found.");

    const after = new URL(req.url).searchParams.get("after");
    let since: Date | undefined;
    if (after) {
        if (!OBJECT_ID.test(after)) return apiError(400, "invalid_body", "Invalid after id.");
        const anchor = await prisma.chatMessage.findFirst({ where: { id: after, conversationId: conv.id } });
        since = anchor?.createdAt;
    }
    const messages = await prisma.chatMessage.findMany({
        where: {
            conversationId: conv.id,
            role: { in: ["visitor", "assistant", "staff"] },
            status: "sent",
            ...(since ? { createdAt: { gt: since } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, role: true, content: true, createdAt: true },
    });
    return Response.json({ status: conv.status, messages }, { headers: { "Cache-Control": "no-store" } });
}
