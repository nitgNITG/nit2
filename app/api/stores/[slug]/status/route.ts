import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { STORE_PRODUCT, storeLiveUrl, storeOps } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stores/<slug>/status — what the owner's card polls. Unlike the academy
// version this does NOT probe the site: the provisioner reports every step to
// /api/tenants/<slug>/progress, so the row already knows. If a job has gone
// quiet for > 3 min we pull the provisioner's own /status once as a fallback.
const STALE_MS = 3 * 60_000;

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const slug = params.slug;
    let store = await prisma.tenant.findUnique({ where: { slug } }).catch(() => null);
    if (!store || store.product !== STORE_PRODUCT) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && store.ownerId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const progress = (store.progressJson ?? null) as { at?: string; state?: string } | null;
    const inFlight = ["queued", "provisioning"].includes(store.status);
    const stale = inFlight && (!progress?.at || Date.now() - new Date(progress.at).getTime() > STALE_MS);
    if (stale) {
        const r = await storeOps.status(slug);
        if (r.ok && r.data?.state === "done") {
            store = await prisma.tenant.update({ where: { slug }, data: { status: "live", lastError: null } });
        } else if (r.ok && r.data?.state === "failed") {
            store = await prisma.tenant.update({ where: { slug }, data: { status: "failed", lastError: String(r.data?.error ?? "provisioning failed").slice(0, 2000) } });
        }
    }
    return NextResponse.json({
        slug, status: store.status, live: store.status === "live", url: storeLiveUrl(slug),
        progress: store.progressJson ?? null, lastError: store.lastError ?? null, imageTag: store.imageTag ?? null,
    });
}
