import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/revenue/settle — mark mirrored payments as settled (paid out to the
// academy owner) or reverse it. Bookkeeping only; no money moves. Admin only.
//
// Body:
//   action?:   "settle" (default) | "unsettle"
//   academySlug: required — the academy to (un)settle
//   currency?:  restrict to one currency (matches a dashboard row)
//   orderIds?:  restrict to specific orders; otherwise all matching rows
//   upToPaidAt?: only rows paid on/before this ISO date (e.g. settle up to month end)
//   reference?: free-text note stored on settled rows (bank ref, batch date)
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const action = body?.action === "unsettle" ? "unsettle" : "settle";
    const academySlug = String(body?.academySlug ?? "").trim().toLowerCase();
    if (!SLUG_RE.test(academySlug)) {
        return NextResponse.json({ error: "invalid academySlug" }, { status: 400 });
    }

    const where: any = { academySlug, status: "paid", settled: action === "settle" ? false : true };
    if (typeof body?.currency === "string" && body.currency.trim()) {
        where.currency = body.currency.trim().toUpperCase().slice(0, 8);
    }
    if (Array.isArray(body?.orderIds) && body.orderIds.length) {
        where.orderId = { in: body.orderIds.map((s: unknown) => String(s)).slice(0, 1000) };
    }
    if (body?.upToPaidAt) {
        const d = new Date(body.upToPaidAt);
        if (!Number.isNaN(d.getTime())) where.paidAt = { lte: d };
    }

    try {
        // Report the amount affected (per currency) before flipping the flag.
        const affected = await prisma.academyRevenue.groupBy({
            by: ["currency"],
            where,
            _sum: { amount: true },
            _count: { _all: true },
        });

        const data = action === "settle"
            ? { settled: true, settledAt: new Date(), settlementRef: body?.reference ? String(body.reference).slice(0, 191) : null }
            : { settled: false, settledAt: null, settlementRef: null };

        const res = await prisma.academyRevenue.updateMany({ where, data });

        return NextResponse.json({
            ok: true,
            action,
            count: res.count,
            amounts: affected.map((a) => ({ currency: a.currency, total: a._sum.amount ?? 0, count: a._count._all })),
        });
    } catch (e) {
        console.error("[revenue/settle] failed", e);
        return NextResponse.json({ error: "settle failed" }, { status: 500 });
    }
}
