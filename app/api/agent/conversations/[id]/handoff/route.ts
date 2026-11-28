// E4 — POST /api/agent/conversations/[id]/handoff (conversation owner).
// The visitor's "Talk to a person" button (FR-W6, AC-06.1).
import { z } from "zod";
import prisma from "@/prisma/client";
import { apiError, getAgentConfig, loadOwnedConversation } from "@/lib/agent";
import { performHandoff } from "@/lib/agent/runtime/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ reason: z.string().trim().max(200).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const conv = await loadOwnedConversation(req, params.id);
    if (!conv) return apiError(404, "conversation_not_found", "Conversation not found.");

    let reason = "visitor_requested";
    const raw = await req.text();
    if (raw.trim()) {
        let json: unknown;
        try { json = JSON.parse(raw); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
        const parsed = Body.safeParse(json);
        if (!parsed.success) return apiError(400, "invalid_body", "Validation failed.");
        if (parsed.data.reason) reason = parsed.data.reason;
    }

    // Summary for staff: the last few visitor lines (masked again in the alert).
    const recent = await prisma.chatMessage.findMany({
        where: { conversationId: conv.id, role: "visitor" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { content: true },
    });
    const summary = conv.summary || recent.reverse().map((m) => m.content).join(" / ").slice(0, 600) || "Visitor asked for a person.";

    const locale = conv.locale === "en" ? "en" : "ar";
    const r = await performHandoff({ conversationId: conv.id, mode: conv.mode, locale, config: await getAgentConfig(), reason, summary });
    if (!r.ok) return apiError(409, "already_with_person", "This conversation is already with a person.", { status: r.status });

    const saved = await prisma.chatMessage.create({ data: { conversationId: conv.id, role: "assistant", content: r.nextReply } });
    // messageId lets the widget recognise this message when it later polls the history (no duplicate).
    return Response.json({ status: r.status, nextReply: r.nextReply, messageId: saved.id });
}
