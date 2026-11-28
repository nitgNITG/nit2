// E20 — GET /api/agent/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD (admin, sales, viewer). FR-N2.
import { guard, parseDateRange } from "@/lib/agent/admin";
import { analyticsReport } from "@/lib/agent/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const g = await guard("analytics");
    if (g.res) return g.res;
    const range = parseDateRange(new URL(req.url).searchParams);
    if (range.res) return range.res;
    return Response.json(await analyticsReport(range.from, range.to));
}
