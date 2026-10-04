import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/revenue/settle — record a payout to an academy owner: create a formal
// Settlement batch (per currency) and mark the matched outstanding rows settled and
// linked to it. Bookkeeping only; no money moves. Admin only.
//
// Only LIVE revenue is settled (test payments are never paid to owners) unless
// mode is overridden.
//
// Body:
//   tenantSlug: required
//   currency?:   restrict to one currency
//   orderIds?:   restrict to specific orders (settle a selection); else all matching
//   upToPaidAt?: only rows paid on/before this ISO date
//   mode?:       "live" (default) | "test"
//   method?:     bank (default) | instapay | cash | wallet | other
//   reference?:  payout reference (bank tx id, cheque no, …)
//   note?:       free text
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const METHODS = new Set(["bank", "instapay", "cash", "wallet", "other"]);

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

    const tenantSlug = String(body?.tenantSlug ?? "").trim().toLowerCase();
    if (!SLUG_RE.test(tenantSlug)) {
        return NextResponse.json({ error: "invalid tenantSlug" }, { status: 400 });
    }

    const where: any = {
        tenantSlug,
        status: "paid",
        settled: false,
        mode: body?.mode === "test" ? "test" : "live",
    };
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

    const method = METHODS.has(String(body?.method)) ? String(body.method) : "bank";
    const reference = body?.reference ? String(body.reference).slice(0, 191) : null;
    const note = body?.note ? String(body.note).slice(0, 4000) : null;

    try {
        // Amount + count per currency (a settlement batch is per currency).
        const affected = await prisma.tenantRevenue.groupBy({
            by: ["currency"],
            where,
            _sum: { amount: true },
            _count: { _all: true },
        });
        if (affected.length === 0) {
            return NextResponse.json({ ok: true, settlements: [], count: 0 });
        }

        const now = new Date();
        const settlements = [];
        for (const grp of affected) {
            const amount = grp._sum.amount ?? 0;
            const txnCount = grp._count._all;
            const settlement = await prisma.settlement.create({
                data: { tenantSlug, currency: grp.currency, amount, txnCount, method, reference, note },
            });
            await prisma.tenantRevenue.updateMany({
                where: { ...where, currency: grp.currency },
                data: { settled: true, settledAt: now, settlementRef: reference, settlementId: settlement.id },
            });
            settlements.push({ id: settlement.id, currency: grp.currency, amount, txnCount });
        }

        return NextResponse.json({
            ok: true,
            settlements,
            count: settlements.reduce((n, s) => n + s.txnCount, 0),
        });
    } catch (e) {
        console.error("[revenue/settle] failed", e);
        return NextResponse.json({ error: "settle failed" }, { status: 500 });
    }
}
