// E5 — POST /api/agent/conversations/[id]/rating (conversation owner). FR-W7.
import { z } from "zod";
import prisma from "@/prisma/client";
import { apiError, loadOwnedConversation } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({
    rating: z.union([z.literal(1), z.literal(-1)]),
    comment: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "rating must be 1 or -1; comment ≤ 500 characters.");

    const conv = await loadOwnedConversation(req, params.id);
    if (!conv) return apiError(404, "conversation_not_found", "Conversation not found.");

    await prisma.conversation.update({
        where: { id: conv.id },
        data: { rating: parsed.data.rating, ratingComment: parsed.data.comment ?? null },
    });
    return Response.json({ ok: true });
}
