// E13 — GET /api/agent/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD (admin, sales, viewer). FR-C3.
import { guard, parseDateRange } from "@/lib/agent/admin";
import { usageReport } from "@/lib/agent/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const g = await guard("analytics");
    if (g.res) return g.res;
    const range = parseDateRange(new URL(req.url).searchParams);
    if (range.res) return range.res;
    return Response.json({ days: await usageReport(range.from, range.to) });
}
