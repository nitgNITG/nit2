import { NextRequest, NextResponse } from "next/server";
// Academy directory lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subdomain scheme the provisioner uses: <slug>.<ACADEMY_BASE_DOMAIN>
// (matches create.sh — `<slug>.academy2026.nitg-eg.com`). Override per env.
const BASE_DOMAIN = process.env.ACADEMY_BASE_DOMAIN ?? "academy2026.nitg-eg.com";

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: cors });
}

/**
 * GET /api/mobile/academies
 *
 * PUBLIC directory the white-label mobile app reads to show its academy picker.
 * The academy-selection step is NOT part of the white-label plan (that MD says
 * provisioning + selection are "owned by business + backend") — so it lives here,
 * in the control plane.
 *
 * Returns LIVE academies only, with just what a picker needs (never `branch` or
 * other internal fields). The app then talks to each academy's own Moodle
 * (design_system.php / getsettings.php) using the returned `url`.
 */
export async function GET(_req: NextRequest) {
    try {
        const rows = await prisma.academy.findMany({
            where: { status: "live" },
            select: { id: true, name: true, slug: true, tier: true },
            orderBy: { name: "asc" },
        });
        const academies = rows.map((a) => ({
            id: a.id,
            name: a.name,
            slug: a.slug,
            tier: a.tier,
            url: `https://${a.slug}.${BASE_DOMAIN}`,
        }));
        return NextResponse.json(
            { academies },
            { headers: { ...cors, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
        );
    } catch (err) {
        console.error("[mobile/academies] list failed", err);
        return NextResponse.json({ academies: [], error: "list failed" }, { status: 200, headers: cors });
    }
}
