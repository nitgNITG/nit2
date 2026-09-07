import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { renewLeadDays } from "@/lib/subscriptions";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/subscriptions/<slug>  { autoRenew: boolean }
// Cancel (autoRenew=false) or resume (true) auto-renew. Owner or admin. Cancelling
// stops future charges — the academy still runs until its term ends, then follows
// the normal expiry/reminder/suspend path. Resuming re-arms billing for the term.
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    if (typeof body?.autoRenew !== "boolean") {
        return NextResponse.json({ error: "autoRenew (boolean) required" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({ where: { academySlug: params.slug } });
    if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && sub.userId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const on = body.autoRenew;
    const DAY = 86_400_000;
    const data = on
        ? {
              autoRenew: true, status: "active", canceledAt: null,
              nextAttemptAt: new Date(sub.currentPeriodEnd.getTime() - renewLeadDays() * DAY),
          }
        : { autoRenew: false, status: "canceled", canceledAt: new Date(), nextAttemptAt: null };

    try {
        const updated = await prisma.subscription.update({ where: { academySlug: params.slug }, data });
        await notifyTelegram(
            on
                ? `🔁 Auto-renew resumed — ${params.slug}`
                : `🚫 Auto-renew cancelled — ${params.slug} (runs until ${updated.currentPeriodEnd.toISOString().slice(0, 10)})`,
        );
        return NextResponse.json({ ok: true, academySlug: updated.academySlug, autoRenew: updated.autoRenew, status: updated.status });
    } catch (e) {
        console.error("[subscriptions] patch failed", params.slug, e);
        return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
}
