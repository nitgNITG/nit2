// GET /api/agent/admin/inbox/summary (sales or support staff) — polled by the
// dashboard sidebar: conversations waiting for a person in the inboxes this
// staff member works, and the ones they own. Drives the badge + desktop alerts.
import { guard } from "@/lib/agent/admin";
import { inboxSummary } from "@/lib/agent/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    return Response.json(await inboxSummary(g.staff));
}
