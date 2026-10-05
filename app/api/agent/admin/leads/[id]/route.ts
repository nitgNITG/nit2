// PATCH /api/agent/admin/leads/[id] (admin or sales) — staff corrects scoring
// fields; the score, tier and breakdown are recalculated at once (FR-L3, AC-35.1).
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { LeadEditSchema, updateLead } from "@/lib/agent/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const g = await guard("leads");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = LeadEditSchema.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Validation failed.");
    const contact = await updateLead(params.id, parsed.data);
    if (!contact) return apiError(404, "not_found", "Lead not found.");
    return Response.json({ contact });
}
