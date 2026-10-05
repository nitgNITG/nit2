// E8 — POST /api/agent/admin/conversations/[id]/takeover. Single winner (AC-12.4).
import { guard } from "@/lib/agent/admin";
import { takeOverConversation } from "@/lib/agent/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    return takeOverConversation(g.staff, params.id);
}
