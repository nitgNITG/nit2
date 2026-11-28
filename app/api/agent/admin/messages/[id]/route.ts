// E17 — PATCH /api/agent/admin/messages/[id] (admin or sales) — approve and send,
// or discard, a follow-up draft (FR-F3, AC-22.2, TS-28). 409 if it is not a draft.
import { z } from "zod";
import { apiError, getAgentConfig } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { decideDraft } from "@/lib/agent/followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ action: z.enum(["send", "discard"]), content: z.string().max(1000).optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const g = await guard("drafts");
    if (g.res) return g.res;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(400, "invalid_body", "action must be send or discard.");
    const r = await decideDraft({ messageId: params.id, action: parsed.data.action, content: parsed.data.content, staffId: g.staff.user.id, cfg: await getAgentConfig() });
    if (!r.ok) return apiError(r.status, r.code, r.message);
    return Response.json({ message: r.message });
}
