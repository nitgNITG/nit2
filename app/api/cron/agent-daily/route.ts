// E18 — GET (or POST) /api/cron/agent-daily, header x-cron-secret = CRON_SECRET.
// Hit once a day by the external scheduler, like /api/cron/expiry. Closes idle
// conversations with a summary and applies the agent's data retention.
import { NextRequest, NextResponse } from "next/server";
import { getAgentConfig } from "@/lib/agent";
import { runDailyMaintenance } from "@/lib/agent/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const result = await runDailyMaintenance(await getAgentConfig());
    console.log(`[cron/agent-daily] ${JSON.stringify(result)}`);
    return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
