import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";
import { triggerApplyIntegrations } from "@/lib/provisionAcademy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Re-pushing to many academies can take a while; give it room.
export const maxDuration = 300;

// POST /api/academies/apply-integrations-all — re-run apply-integrations for EVERY
// academy, so newly-added integration config (e.g. the revenue-ledger ingest URL/
// secret) reaches academies that already exist. Each academy's env is rebuilt from
// ITS OWN licence via triggerApplyIntegrations, so this never changes an academy's
// Kashier on/off state — it only (re)writes the current, correct config. Admin only.
//
// Auth: an admin session, OR the worker secret header (so it can be curled/cron'd).
export async function POST(req: NextRequest) {
    const workerOk = !!process.env.WORKER_SECRET && req.headers.get("x-worker-secret") === process.env.WORKER_SECRET;
    if (!workerOk && !(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!process.env.PROVISION_URL || !process.env.PROVISION_SECRET) {
        return NextResponse.json({ error: "provisioning not configured" }, { status: 503 });
    }

    let academies: { slug: string; tier: string }[] = [];
    try {
        academies = await prisma.tenant.findMany({ select: { slug: true, tier: true } });
    } catch (e) {
        console.error("[apply-integrations-all] list failed", e);
        return NextResponse.json({ error: "could not list academies" }, { status: 500 });
    }

    // Resolve each academy's licence once (tier -> videoSource / kashierEnabled) so the
    // pushed env matches the academy's real integration state.
    const licenses = await prisma.license.findMany({ select: { key: true, videoSource: true, kashierEnabled: true } });
    const licByKey = new Map(licenses.map((l) => [l.key, l]));

    let applied = 0;
    const skipped: string[] = [];
    // Small concurrency so we don't stampede the provisioner.
    const BATCH = 5;
    for (let i = 0; i < academies.length; i += BATCH) {
        const batch = academies.slice(i, i + BATCH);
        await Promise.all(
            batch.map(async (a) => {
                const lic = licByKey.get(a.tier);
                if (!lic) {
                    // Unknown tier: skip rather than risk pushing a wrong (kashier-off) state.
                    skipped.push(a.slug);
                    return;
                }
                await triggerApplyIntegrations(a.slug, {
                    videoSource: lic.videoSource ?? "all",
                    kashierEnabled: !!lic.kashierEnabled,
                });
                applied++;
            }),
        );
    }

    return NextResponse.json({
        ok: true,
        total: academies.length,
        applied,
        skipped,
    });
}
