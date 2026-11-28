import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";
import { aggregateLeadEvents, monthStartUtc } from "@/lib/leadEvents";

// Admin-only, read-only roll-up of LeadEvent (see app/api/track):
// counts by UTC month x type x locale and the top pages, for the last
// `?months=` months including the current one (default 6, 1..24).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        if (!(await authAdmin(req))) return NextResponse.json({ message: "Not allow" }, { status: 401 });
        const n = parseInt(new URL(req.url).searchParams.get("months") ?? "", 10);
        const months = Number.isNaN(n) ? 6 : Math.min(24, Math.max(1, n));
        const since = monthStartUtc(new Date(), months - 1);
        // Lead events are low-volume (a few per lead), so rolling them up here is fine.
        const rows = await prisma.leadEvent.findMany({
            where: { createdAt: { gte: since } },
            select: { type: true, locale: true, page: true, createdAt: true },
        });
        return NextResponse.json({ months, since: since.toISOString(), ...aggregateLeadEvents(rows) });
    } catch (error) {
        console.error("[lead-events]", (error as Error)?.message);
        return NextResponse.json({ message: "There is error in server!!" }, { status: 500 });
    }
}
