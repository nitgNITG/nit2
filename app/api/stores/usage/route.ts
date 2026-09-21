import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchStoreHealth, storeOps } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stores/usage (admin) — store host snapshot + per-store image tag / DB size.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const [usage, health] = await Promise.all([storeOps.usage(), fetchStoreHealth()]);
    return NextResponse.json({
        ok: usage.ok,
        stores: usage.ok ? usage.data?.stores ?? {} : {},
        host: health ? { disk: health.disk, memory: health.memory, cpu: health.cpu, docker: health.docker, image_tag: (health as any).image_tag ?? null } : null,
        error: usage.ok ? undefined : usage.error,
    });
}
