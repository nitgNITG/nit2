import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { Prisma } from "prismamysql";
import { triggerSuspend, triggerExpiryReminder, deprovisionAndDeleteAcademy } from "@/lib/provisionAcademy";

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

    // 1b) Pre-expiry reminders → email the owner via the academy's own Moodle
    // mail at 7 / 3 / 1 days before, and once on expiry (day 0, still within
    // grace). Each stage is sent at most once per term (tracked in
    // expiryRemindersSent, cleared on renewal / plan change).
    const REMIND_DAYS = [7, 3, 1, 0];
    // Build the renew link from the host the cron was actually called on (the
    // scheduler hits the public URL), so the email link is correct regardless of
    // NEXT_PUBLIC_BASE_URL (which Next bakes at build time and is often localhost).
    const hdrHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const hdrProto = req.headers.get("x-forwarded-proto") || "https";
    const base = (
        hdrHost
            ? `${hdrProto}://${hdrHost}`
            : (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "")
    ).replace(/\/$/, "");
    const renewUrl = base ? `${base}/account` : "";
    const soon = await prisma.academy
        .findMany({
            where: {
                status: "live",
                validUntil: { not: null, lte: new Date(now + 7 * 86_400_000) },
            },
            select: { slug: true, validUntil: true, expiryRemindersSent: true },
        })
        .catch((e) => { console.error("[cron/expiry] reminder query failed", e); return []; });

    const reminded: string[] = [];
    for (const a of soon) {
        if (!a.validUntil) continue;
        const daysLeft = Math.ceil((a.validUntil.getTime() - now) / 86_400_000);
        const sent: Record<string, unknown> =
            a.expiryRemindersSent && typeof a.expiryRemindersSent === "object"
                ? { ...(a.expiryRemindersSent as Record<string, unknown>) }
                : {};
        // Largest unsent threshold reached (undefined = no email due this run).
        const stage = REMIND_DAYS.find((t) => daysLeft <= t && !sent[`d${t}`]);
        const sendEmail = stage !== undefined;
        // Keep the academy's local_license/expirydate in sync with validUntil (as
        // YYYY-MM-DD, UTC) every run, so the in-academy banner always matches —
        // even when no reminder email is due.
        const d = a.validUntil;
        const expiryDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        try {
            await triggerExpiryReminder(a.slug, daysLeft, renewUrl, { expiryDate, sendEmail });
            if (sendEmail) {
                sent[`d${stage}`] = Date.now();
                await prisma.academy.update({
                    where: { slug: a.slug },
                    data: { expiryRemindersSent: sent as Prisma.InputJsonValue },
                });
                reminded.push(a.slug);
            }
        } catch (e) {
            console.error("[cron/expiry] reminder failed", a.slug, e);
        }
    }

    // 1c) Auto-delete: PERMANENTLY remove academies that have been suspended
    // (expired past grace) for longer than the platform's `auto_delete_days`.
    // Opt-in and conservative: only status='suspended' rows are eligible, so an
    // academy must have already been expired + suspended by step (1); a renewed
    // one is 'live' again and never matches. 0 / blank = never auto-delete.
    let autoDeleteDays = 0;
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key: "auto_delete_days" } });
        autoDeleteDays = Math.max(0, parseInt(row?.value ?? "0", 10) || 0);
    } catch (e) {
        console.error("[cron/expiry] auto_delete_days read failed", e);
    }
    const deleted: string[] = [];
    if (autoDeleteDays > 0) {
        const delCutoff = new Date(now - autoDeleteDays * 86_400_000);
        const toDelete = await prisma.academy
            .findMany({
                where: { status: "suspended", validUntil: { not: null, lt: delCutoff } },
                select: { slug: true },
            })
            .catch((e) => { console.error("[cron/expiry] delete query failed", e); return []; });
        for (const a of toDelete) {
            try {
                if (await deprovisionAndDeleteAcademy(a.slug)) deleted.push(a.slug);
            } catch (e) {
                console.error("[cron/expiry] auto-delete failed", a.slug, e);
            }
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

    return NextResponse.json({ ok: true, graceDays, suspended, reminded, deleted, autoDeleteDays, expiredPayments });
}
