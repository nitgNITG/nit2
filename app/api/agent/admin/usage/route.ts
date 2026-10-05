// E13 — GET /api/agent/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD (admin, sales, viewer). FR-C3.
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { usageReport } from "@/lib/agent/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
    const g = await guard("analytics");
    if (g.res) return g.res;
    const q = new URL(req.url).searchParams;
    const from = q.get("from");
    const to = q.get("to");
    if (!from || !to || !DATE.test(from) || !DATE.test(to)) return apiError(400, "invalid_query", "from and to are required (YYYY-MM-DD).");
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1) return apiError(400, "invalid_query", "to must not be before from.");
    if (days > 90) return apiError(400, "invalid_query", "At most 90 days.");
    return Response.json({ days: await usageReport(from, to) });
}
