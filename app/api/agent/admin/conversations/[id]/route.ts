// E7 — GET /api/agent/admin/conversations/[id] (staff: sales or support). FR-I2.
import { guard } from "@/lib/agent/admin";
import { conversationDetail } from "@/lib/agent/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    return conversationDetail(g.staff, params.id);
}
