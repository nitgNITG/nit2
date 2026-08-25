import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeBrand } from "@/lib/brand";

export const runtime = "nodejs";

// Ask server B to re-apply the branding to the live academy (logo / colours /
// hero / about / gallery / contact / login / footer). Best-effort — server B
// returns 202 and runs apply-branding.sh in the background.
async function triggerApplyBranding(slug: string, brand: unknown, platformLang: string): Promise<boolean> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return false;
    try {
        const url = new URL(base);
        url.pathname = `/apply-branding/${slug}`;
        const res = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ brand, platform_lang: platformLang }),
        });
        return res.ok;
    } catch (e) {
        console.error("[academies] apply-branding trigger failed", slug, e);
        return false;
    }
}

// POST /api/academies/<slug>/branding  { brand, platform_lang? }
// Re-apply branding to a LIVE academy without recreating it. Admin, or the
// academy's own owner.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const slug = params.slug;
    const academy = await prisma.academy.findUnique({ where: { slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && academy.ownerId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    // Only a running site can have its branding re-applied.
    if (!["live", "suspended"].includes(academy.status)) {
        return NextResponse.json({ error: "academy is not live yet" }, { status: 409 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const brand = sanitizeBrand(body?.brand);
    const platformLangRaw = String(body?.platform_lang ?? "").trim().toLowerCase();
    const platformLang = ["ar", "en", "both"].includes(platformLangRaw) ? platformLangRaw : "";

    // Nothing to apply? (No brand fields and no language.) The footer step still
    // runs server-side, so an empty payload legitimately just ensures the footer.
    const queued = await triggerApplyBranding(slug, brand, platformLang);
    if (!queued) {
        return NextResponse.json({ error: "provisioning not configured or unreachable" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, slug, status: "applying-branding" });
}
