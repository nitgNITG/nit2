import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { triggerSuspend } from "@/lib/provisionAcademy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/cron/expiry — hit by an external scheduler (cron/uptime) once a day.
// Header: x-cron-secret must match CRON_SECRET. Two housekeeping jobs:
//   1) Suspend any live academy whose term ended more than GRACE days ago.
//   2) Expire pending payments older than an hour (the checkout was abandoned).
// Both are idempotent — re-running does nothing new.
export async function POST(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("x-cron-secret") !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const graceDays = Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 3) || 0);
    const now = Date.now();
    const cutoff = new Date(now - graceDays * 86_400_000);

    // 1) Expired academies → suspend (soft-lock in Moodle, keep data).
    const expired = await prisma.academy
        .findMany({
            where: { status: "live", validUntil: { not: null, lt: cutoff } },
            select: { slug: true, name: true, validUntil: true, ownerId: true },
        })
        .catch((e) => { console.error("[cron/expiry] query failed", e); return []; });

    const suspended: string[] = [];
    for (const a of expired) {
        try {
            await prisma.academy.update({ where: { slug: a.slug }, data: { status: "suspended" } });
            await triggerSuspend(a.slug, true);
            suspended.push(a.slug);
        } catch (e) {
            console.error("[cron/expiry] suspend failed", a.slug, e);
        }
    }

    // 2) Abandoned checkouts → mark expired so they stop showing as pending.
    const staleBefore = new Date(now - 60 * 60_000);
    let expiredPayments = 0;
    try {
        const r = await prisma.payment.updateMany({
            where: { status: "pending", createdAt: { lt: staleBefore } },
            data: { status: "expired" },
        });
        expiredPayments = r.count;
    } catch (e) {
        console.error("[cron/expiry] payment sweep failed", e);
    }

    return NextResponse.json({ ok: true, graceDays, suspended, expiredPayments });
}
