// E10 — POST /api/agent/admin/conversations/[id]/messages { content }. Staff reply.
import { z } from "zod";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { staffReply } from "@/lib/agent/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ content: z.string().trim().min(1).max(4000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "content must be 1–4,000 characters.");
    return staffReply(g.staff, params.id, parsed.data.content);
}
