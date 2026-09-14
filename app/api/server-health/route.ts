import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { evaluateServerHealth } from "@/lib/serverHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/server-health — server-B (academies host) health + the create verdict.
// Admin-only. Degrades gracefully: when server B is unreachable the verdict says
// so (ok:false, reason:"unreachable") rather than erroring, so the dashboard can
// render "unreachable" instead of failing to load.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const verdict = await evaluateServerHealth();
    return NextResponse.json(verdict);
}
