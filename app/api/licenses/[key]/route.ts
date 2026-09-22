import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { parseLicense } from "@/lib/licenseShape";
import { toLicenseDefinition, computeUpgradable } from "@/lib/licenseDefinition";
import { triggerApplyIntegrations } from "@/lib/provisionAcademy";
import { pushStoreLicense } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Push an edited licence to every live academy on it, so changes take effect
// immediately (no manual Change-plan / Update-all-sites). Best-effort.
async function reapplyToAcademies(
    key: string, definition: string,
    integrationLic: { videoSource: string; kashierEnabled: boolean },
): Promise<number> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return 0;
    const academies = await prisma.tenant.findMany({ where: { tier: key, status: "live" }, select: { slug: true } });
    await Promise.allSettled(
        academies.flatMap((a) => {
            const url = new URL(base);
            url.pathname = `/apply-license/${a.slug}`;
            return [
                fetch(url.toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
                    body: JSON.stringify({ tier: key, definition }),
                }),
                // also refresh the shared integration creds (videoSource / Kashier may have changed)
                triggerApplyIntegrations(a.slug, integrationLic),
            ];
        }),
    );
    return academies.length;
}

// Same for stores: every live store on this plan gets the new caps/features
// pushed into its own PlatformLicense row, so a toggle takes effect at once
// instead of waiting for the next plan change or renewal.
async function reapplyToStores(key: string): Promise<number> {
    const stores = await prisma.tenant.findMany({ where: { tier: key, product: "store", status: "live" }, select: { slug: true } });
    const results = await Promise.allSettled(stores.map((s) => pushStoreLicense(s.slug)));
    const failed = results.filter((r) => r.status === "rejected" || !r.value.ok);
    if (failed.length) console.error(`[licenses] re-apply to stores: ${failed.length}/${stores.length} failed for ${key}`);
    return stores.length - failed.length;
}

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    if (user.role !== "admin") return { error: "forbidden", status: 403 as const };
    return null;
}

// PUT /api/licenses/<key> — update a licence (admin). The key itself is immutable.
export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    try {
        const data = parseLicense(await req.json());
        if (!data.name) return NextResponse.json({ error: "name required" }, { status: 400 });
        const license = await prisma.license.update({ where: { key: params.key }, data });
        // Push the new limits/features to every tenant already on this licence.
        let applied = 0;
        let noun = "academies";
        if (license.product === "store") {
            applied = await reapplyToStores(params.key);
            noun = applied === 1 ? "store" : "stores";
        } else {
            const rankLics = await prisma.license.findMany({ where: { active: true }, select: { key: true, active: true, order: true, priceEgp: true } });
            applied = await reapplyToAcademies(params.key, toLicenseDefinition(license, { upgradable: computeUpgradable(params.key, rankLics) }), {
                videoSource: license.videoSource, kashierEnabled: license.kashierEnabled,
            });
            noun = applied === 1 ? "academy" : "academies";
        }
        return NextResponse.json({ license, applied, message: `License updated${applied ? ` — re-applied to ${applied} ${noun}` : ""}` });
    } catch (err: any) {
        if (err?.code === "P2025") return NextResponse.json({ error: "not found" }, { status: 404 });
        console.error("[licenses] update failed", err);
        return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
}

// DELETE /api/licenses/<key> — remove a licence (admin). Blocked while academies use it.
export async function DELETE(_req: NextRequest, { params }: { params: { key: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    try {
        const inUse = await prisma.tenant.count({ where: { tier: params.key } });
        if (inUse > 0) {
            return NextResponse.json(
                { error: `Can't delete — ${inUse} academ${inUse === 1 ? "y is" : "ies are"} on this licence. Move them first.` },
                { status: 409 },
            );
        }
        await prisma.license.delete({ where: { key: params.key } });
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        if (err?.code === "P2025") return NextResponse.json({ error: "not found" }, { status: 404 });
        console.error("[licenses] delete failed", err);
        return NextResponse.json({ error: "delete failed" }, { status: 500 });
    }
}
