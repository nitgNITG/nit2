import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// GET /api/revenue/settlements?tenantSlug= — payout history for one academy
// (newest first). Admin only.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const slug = (new URL(req.url).searchParams.get("tenantSlug") ?? "").trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ error: "invalid tenantSlug" }, { status: 400 });
    }
    try {
        const settlements = await prisma.settlement.findMany({
            where: { tenantSlug: slug },
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ settlements });
    } catch (e) {
        console.error("[revenue/settlements] list failed", e);
        return NextResponse.json({ error: "list failed" }, { status: 500 });
    }
}

// DELETE /api/revenue/settlements?id= — void a payout: unlink its rows (back to
// outstanding) and delete the record. Admin only.
export async function DELETE(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const id = (new URL(req.url).searchParams.get("id") ?? "").trim();
    if (!id) {
        return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    try {
        const settlement = await prisma.settlement.findUnique({ where: { id } });
        if (!settlement) {
            return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        await prisma.tenantRevenue.updateMany({
            where: { settlementId: id },
            data: { settled: false, settledAt: null, settlementRef: null, settlementId: null },
        });
        await prisma.settlement.delete({ where: { id } });
        return NextResponse.json({ ok: true, voided: id });
    } catch (e) {
        console.error("[revenue/settlements] void failed", e);
        return NextResponse.json({ error: "void failed" }, { status: 500 });
    }
}
