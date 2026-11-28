// GET /api/agent/admin/usage/breakdown?from&to&by=visitor|ip (admin, sales, viewer) —
// cost per model, per UTC day (to compare with the Anthropic console) and per visitor.
import { apiError } from "@/lib/agent";
import { guard, parseDateRange } from "@/lib/agent/admin";
import { costBreakdown } from "@/lib/agent/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const g = await guard("analytics");
    if (g.res) return g.res;
    const params = new URL(req.url).searchParams;
    const range = parseDateRange(params);
    if (range.res) return range.res;
    const by = params.get("by") ?? "visitor";
    if (by !== "visitor" && by !== "ip") return apiError(400, "validation_failed", "by must be visitor or ip.");
    return Response.json(await costBreakdown(range.from, range.to, by));
}
