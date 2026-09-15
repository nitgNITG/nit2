import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/revenue/transactions?academySlug=&currency=&settled=all|true|false&from=&to=&limit=
// Individual mirrored payments for one academy — the per-transaction drill-down behind
// the dashboard's per-academy row. Admin only.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const academySlug = (url.searchParams.get("academySlug") ?? "").trim().toLowerCase();
    if (!SLUG_RE.test(academySlug)) {
        return NextResponse.json({ error: "invalid academySlug" }, { status: 400 });
    }

    const where: any = { academySlug, status: "paid" };
    const currency = url.searchParams.get("currency");
    if (currency) where.currency = currency.trim().toUpperCase().slice(0, 8);
    const settled = url.searchParams.get("settled");
    if (settled === "true") where.settled = true;
    else if (settled === "false") where.settled = false;
    const mode = url.searchParams.get("mode");
    if (mode === "live" || mode === "test") where.mode = mode;

    const parseDate = (s: string | null) => {
        if (!s) return undefined;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    if (from || to) where.paidAt = { gte: from, lte: to };

    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200", 10) || 200));

    try {
        const [rows, academy] = await Promise.all([
            prisma.academyRevenue.findMany({
                where,
                orderBy: { paidAt: "desc" },
                take: limit,
                select: {
                    id: true, orderId: true, amount: true, currency: true, provider: true,
                    kind: true, courseId: true, userRef: true, paidAt: true, mode: true,
                    settled: true, settledAt: true, settlementRef: true, settlementId: true,
                },
            }),
            prisma.academy.findUnique({ where: { slug: academySlug }, select: { name: true } }),
        ]);
        return NextResponse.json({ academyName: academy?.name ?? academySlug, transactions: rows });
    } catch (e) {
        console.error("[revenue/transactions] failed", e);
        return NextResponse.json({ error: "list failed" }, { status: 500 });
    }
}
