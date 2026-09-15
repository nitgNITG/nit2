import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/revenue/summary?from=ISO&to=ISO — categorised revenue for the dashboard:
//   • student revenue per academy (from the AcademyRevenue ledger), and
//   • NIT's OWN revenue per purpose (from the Payment table, licence sales),
// each broken down by currency. Admin only.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parseDate = (s: string | null): Date | undefined => {
        if (!s) return undefined;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? undefined : d;
    };
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));
    const range = from || to ? { gte: from, lte: to } : undefined;
    // Live vs test/sandbox. Default "live" so test payments don't inflate real revenue.
    const modeParam = url.searchParams.get("mode");
    const modeFilter = modeParam === "test" ? { mode: "test" } : modeParam === "all" ? {} : { mode: "live" };

    try {
        // ── Student revenue (per academy, per currency, split by settled) ─────────
        const studentGroups = await prisma.academyRevenue.groupBy({
            by: ["academySlug", "currency", "settled"],
            where: { status: "paid", ...modeFilter, ...(range ? { paidAt: range } : {}) },
            _sum: { amount: true },
            _count: { _all: true },
        });

        // Attach academy display names (slug → name); ownerless/unknown slugs pass through.
        const slugs = Array.from(new Set(studentGroups.map((g) => g.academySlug)));
        const academies = slugs.length
            ? await prisma.academy.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })
            : [];
        const nameBySlug = new Map(academies.map((a) => [a.slug, a.name]));

        // Fold the settled/unsettled halves into one row per (academy, currency) with
        // earned / settled / outstanding.
        const rowMap = new Map<string, { slug: string; name: string; currency: string; count: number; total: number; settled: number; outstanding: number }>();
        for (const g of studentGroups) {
            const key = `${g.academySlug}|${g.currency}`;
            const row = rowMap.get(key) ?? {
                slug: g.academySlug,
                name: nameBySlug.get(g.academySlug) ?? g.academySlug,
                currency: g.currency,
                count: 0, total: 0, settled: 0, outstanding: 0,
            };
            const amt = g._sum.amount ?? 0;
            row.count += g._count._all;
            row.total += amt;
            if (g.settled) row.settled += amt;
            else row.outstanding += amt;
            rowMap.set(key, row);
        }
        const byAcademy = Array.from(rowMap.values()).sort((a, b) => b.outstanding - a.outstanding || b.total - a.total);

        // ── NIT's own revenue (licence sales, per purpose, per currency) ──────────
        const ownGroups = await prisma.payment.groupBy({
            by: ["purpose", "currency"],
            where: { status: "paid", ...modeFilter, ...(range ? { paidAt: range } : {}) },
            _sum: { amount: true },
            _count: { _all: true },
        });
        const byPurpose = ownGroups
            .map((g) => ({
                purpose: g.purpose,
                currency: g.currency,
                count: g._count._all,
                total: g._sum.amount ?? 0,
            }))
            .sort((a, b) => b.total - a.total);

        // ── Totals per currency (student, own, combined) ──────────────────────────
        const sumByCurrency = (rows: { currency: string; total: number; count: number }[]) => {
            const m = new Map<string, { currency: string; total: number; count: number }>();
            for (const r of rows) {
                const e = m.get(r.currency) ?? { currency: r.currency, total: 0, count: 0 };
                e.total += r.total;
                e.count += r.count;
                m.set(r.currency, e);
            }
            return Array.from(m.values()).sort((a, b) => b.total - a.total);
        };
        // Student totals also carry settled / outstanding per currency.
        const stMap = new Map<string, { currency: string; total: number; count: number; settled: number; outstanding: number }>();
        for (const r of byAcademy) {
            const e = stMap.get(r.currency) ?? { currency: r.currency, total: 0, count: 0, settled: 0, outstanding: 0 };
            e.total += r.total;
            e.count += r.count;
            e.settled += r.settled;
            e.outstanding += r.outstanding;
            stMap.set(r.currency, e);
        }
        const studentTotals = Array.from(stMap.values()).sort((a, b) => b.total - a.total);
        const ownTotals = sumByCurrency(byPurpose);
        const grandTotals = sumByCurrency([...byAcademy, ...byPurpose]);
        const outstandingTotals = studentTotals
            .filter((t) => t.outstanding > 0)
            .map((t) => ({ currency: t.currency, total: t.outstanding, count: 0 }));

        return NextResponse.json({
            range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
            student: { byAcademy, totals: studentTotals },
            own: { byPurpose, totals: ownTotals },
            grandTotals,
            outstandingTotals,
        });
    } catch (e) {
        console.error("[revenue/summary] failed", e);
        return NextResponse.json({ error: "summary failed" }, { status: 500 });
    }
}
