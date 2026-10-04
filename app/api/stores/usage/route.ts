import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prismaMysql";
import { fetchStoreHealth, storeOps } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stores/usage (admin) — store host snapshot + per-store image tag / DB size.
// The host is the source of truth for the running image: fleet rollouts
// (CI callback, auto-update, "Roll out to all") run outside a per-store job and
// never report back, so Tenant.imageTag is reconciled here on every read.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const [usage, health] = await Promise.all([storeOps.usage(), fetchStoreHealth()]);
    const stores: Record<string, { image_tag?: string | null; db_bytes?: number }> = usage.ok ? usage.data?.stores ?? {} : {};
    const synced = await syncImageTags(stores);
    return NextResponse.json({
        ok: usage.ok,
        stores,
        synced,
        host: health ? { disk: health.disk, memory: health.memory, cpu: health.cpu, docker: health.docker, image_tag: (health as any).image_tag ?? null } : null,
        error: usage.ok ? undefined : usage.error,
    });
}

// Returns the slugs whose stored imageTag was brought in line with the host.
async function syncImageTags(stores: Record<string, { image_tag?: string | null }>): Promise<string[]> {
    const slugs = Object.keys(stores).filter((s) => stores[s]?.image_tag);
    if (slugs.length === 0) return [];
    const rows = await prisma.tenant.findMany({ where: { product: "store", slug: { in: slugs } }, select: { slug: true, imageTag: true } });
    const stale = rows.filter((r) => r.imageTag !== stores[r.slug].image_tag);
    await Promise.all(stale.map((r) => prisma.tenant.update({ where: { slug: r.slug }, data: { imageTag: stores[r.slug].image_tag! } })));
    return stale.map((r) => r.slug);
}
