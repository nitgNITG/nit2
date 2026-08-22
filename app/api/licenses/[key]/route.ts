import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { parseLicense } from "@/lib/licenseShape";
import { toLicenseDefinition } from "@/lib/licenseDefinition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Push an edited licence to every live academy on it, so changes take effect
// immediately (no manual Change-plan / Update-all-sites). Best-effort.
async function reapplyToAcademies(key: string, definition: string): Promise<number> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return 0;
    const academies = await prisma.academy.findMany({ where: { tier: key, status: "live" }, select: { slug: true } });
    await Promise.allSettled(
        academies.map((a) => {
            const url = new URL(base);
            url.pathname = `/apply-license/${a.slug}`;
            return fetch(url.toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
                body: JSON.stringify({ tier: key, definition }),
            });
        }),
    );
    return academies.length;
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
        // Push the new limits/features to every academy already on this licence.
        const applied = await reapplyToAcademies(params.key, toLicenseDefinition(license));
        return NextResponse.json({ license, applied, message: `License updated${applied ? ` — re-applied to ${applied} academ${applied === 1 ? "y" : "ies"}` : ""}` });
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
        const inUse = await prisma.academy.count({ where: { tier: params.key } });
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
