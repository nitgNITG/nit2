// GET /api/agent/admin/abuse (admin) — today's abuse stats for AI Settings.
import { guard } from "@/lib/agent/admin";
import { abuseStats } from "@/lib/agent/abuse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const g = await guard("settings");
    if (g.res) return g.res;
    return Response.json(await abuseStats());
}
