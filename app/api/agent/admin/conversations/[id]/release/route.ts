// E9 — POST /api/agent/admin/conversations/[id]/release. Hand back to the agent.
import { guard } from "@/lib/agent/admin";
import { releaseConversation } from "@/lib/agent/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    return releaseConversation(g.staff, params.id);
}
