// GET /api/agent/admin/followups?status=draft|sent|discarded (admin or sales) —
// the Follow-ups page: AI-drafted messages waiting for approval, and the history.
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { listFollowUps } from "@/lib/agent/followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const g = await guard("drafts");
    if (g.res) return g.res;
    const status = new URL(req.url).searchParams.get("status") ?? "draft";
    if (status !== "draft" && status !== "sent" && status !== "discarded") return apiError(400, "invalid_query", "Unknown status.");
    return Response.json({ items: await listFollowUps(status) });
}
