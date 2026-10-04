import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { Prisma } from "prismamysql";
import { triggerSuspend, triggerExpiryReminder, deprovisionAndDeleteAcademy } from "@/lib/provisionAcademy";
import { notifyTelegram } from "@/lib/telegram";
import { storeOps, deprovisionAndDeleteStore } from "@/lib/products/store";
import { sendStoreExpiryEmail, type StoreExpiryStage } from "@/lib/tenants/storeExpiryEmail";
import { runBillingCycle, runPreRenewNotices, weeklyBillingSummary } from "@/lib/billing";

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

    // Build the public origin from the host the cron was actually called on (the
    // scheduler hits the public URL), so email/renew links are correct regardless
    // of NEXT_PUBLIC_BASE_URL (which Next bakes at build time and is often localhost).
    const hdrHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const hdrProto = req.headers.get("x-forwarded-proto") || "https";
    const base = (
        hdrHost
            ? `${hdrProto}://${hdrHost}`
            : (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "")
    ).replace(/\/$/, "");
    const renewUrl = base ? `${base}/account` : "";

    // 0a) Pre-renewal heads-up emails — tell owners their card will be auto-charged
    // soon (once per cycle), BEFORE the charge runs. No-op unless the feature is on.
    const preRenew = await runPreRenewNotices(base).catch((e) => {
        console.error("[cron/expiry] pre-renew notices failed", e);
        return { notified: [] as string[] };
    });

    // 0b) Auto-renew billing — charge due subscriptions off-session via saved card
    // token BEFORE the suspend sweep, so a successful renewal prevents suspension.
    // No-op unless SUBSCRIPTIONS_ENABLED=1 (returns { skipped:true }).
    const billing = await runBillingCycle(base).catch((e) => {
        console.error("[cron/expiry] billing cycle failed", e);
        return { attempted: 0, renewed: [], failed: [], needsAuth: [] };
    });

    // How long a suspended tenant is kept before auto-delete (used by 1c, and
    // quoted in the store suspension e-mail). 0 / blank = never.
    let autoDeleteDays = 0;
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key: "auto_delete_days" } });
        autoDeleteDays = Math.max(0, parseInt(row?.value ?? "0", 10) || 0);
    } catch (e) {
        console.error("[cron/expiry] auto_delete_days read failed", e);
    }

    // Owner e-mail lookup for the store mails (academies are mailed by Moodle).
    const owners = new Map<string, { email: string; name: string | null }>();
    const loadOwners = async (ids: (string | null)[]) => {
        const missing = Array.from(new Set(ids.filter((id): id is string => !!id && !owners.has(id))));
        if (!missing.length) return;
        const rows = await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, email: true, name: true } }).catch(() => []);
        for (const u of rows) owners.set(u.id, { email: u.email, name: u.name });
    };

    // 1) Expired tenants → suspend (academy: soft-lock in Moodle; store: licence
    // gate shows "temporarily unavailable"). Data is kept.
    const expired = await prisma.tenant
        .findMany({
            where: { status: "live", validUntil: { not: null, lt: cutoff } },
            select: { slug: true, name: true, validUntil: true, ownerId: true, product: true, tier: true },
        })
        .catch((e) => { console.error("[cron/expiry] query failed", e); return []; });

    const suspended: string[] = [];
    await loadOwners(expired.filter((a) => a.product === "store").map((a) => a.ownerId));
    for (const a of expired) {
        try {
            await prisma.tenant.update({ where: { slug: a.slug }, data: { status: "suspended" } });
            if (a.product === "store") await storeOps.suspend(a.slug, true);
            else await triggerSuspend(a.slug, true);
            suspended.push(a.slug);
        } catch (e) {
            console.error("[cron/expiry] suspend failed", a.slug, e);
            continue;
        }
        // Store owners get a "suspended — renew to bring it back" mail (once: the
        // row is no longer 'live', so it never matches this sweep again).
        if (a.product === "store" && a.validUntil) {
            const o = a.ownerId ? owners.get(a.ownerId) : undefined;
            if (!o) continue;
            try {
                await sendStoreExpiryEmail({
                    to: o.email, ownerName: o.name, storeName: a.name, slug: a.slug, tier: a.tier,
                    validUntil: a.validUntil, renewUrl, stage: "suspended", graceDays, autoDeleteDays,
                });
            } catch (e) {
                console.error("[cron/expiry] suspension mail failed", a.slug, e);
            }
        }
    }
    if (suspended.length) {
        await notifyTelegram(`⛔ Expired & suspended (${suspended.length}): ${suspended.join(", ")}`);
    }

    // 1b) Pre-expiry reminders → email the owner via the academy's own Moodle
    // mail at 7 / 3 / 1 days before, and once on expiry (day 0, still within
    // grace). Each stage is sent at most once per term (tracked in
    // expiryRemindersSent, cleared on renewal / plan change).
    const REMIND_DAYS = [7, 3, 1, 0];
    const soon = await prisma.tenant
        .findMany({
            where: {
                status: "live",
                validUntil: { not: null, lte: new Date(now + 7 * 86_400_000) },
            },
            select: { slug: true, name: true, validUntil: true, expiryRemindersSent: true, product: true, ownerId: true, tier: true },
        })
        .catch((e) => { console.error("[cron/expiry] reminder query failed", e); return []; });
    // Stores: same stages, but the mail comes from nit2 (the store has no platform
    // mail path; the renew action is on /account). Stores on auto-renew are told
    // by the pre-renew / payment-failed notices in lib/billing.ts instead — a
    // "renew now" mail on top of "your card will be charged" would contradict it.
    const soonStores = soon.filter((a) => a.product === "store");
    const autoRenewing = new Set<string>();
    if (soonStores.length) {
        const subs = await prisma.subscription
            .findMany({ where: { tenantSlug: { in: soonStores.map((a) => a.slug) }, status: { in: ["active", "past_due"] } }, select: { tenantSlug: true } })
            .catch(() => []);
        for (const x of subs) autoRenewing.add(x.tenantSlug);
        await loadOwners(soonStores.map((a) => a.ownerId));
    }

    const reminded: string[] = [];
    for (const a of soon) {
        if (!a.validUntil) continue;
        if (a.product === "store" && autoRenewing.has(a.slug)) continue;
        const daysLeft = Math.ceil((a.validUntil.getTime() - now) / 86_400_000);
        const sent: Record<string, unknown> =
            a.expiryRemindersSent && typeof a.expiryRemindersSent === "object"
                ? { ...(a.expiryRemindersSent as Record<string, unknown>) }
                : {};
        // Largest unsent threshold reached (undefined = no email due this run).
        const stage = REMIND_DAYS.find((t) => daysLeft <= t && !sent[`d${t}`]);
        const sendEmail = stage !== undefined;
        if (a.product === "store") {
            if (!sendEmail) continue;
            const o = a.ownerId ? owners.get(a.ownerId) : undefined;
            if (!o) { console.error("[cron/expiry] store owner not found", a.slug); continue; }
            try {
                const ok = await sendStoreExpiryEmail({
                    to: o.email, ownerName: o.name, storeName: a.name, slug: a.slug, tier: a.tier,
                    validUntil: a.validUntil, renewUrl, stage: Math.max(0, daysLeft) as StoreExpiryStage, graceDays, autoDeleteDays,
                });
                if (!ok) continue;   // SMTP off: leave the stage unsent so it goes out once mail works
                sent[`d${stage}`] = Date.now();
                await prisma.tenant.update({ where: { slug: a.slug }, data: { expiryRemindersSent: sent as Prisma.InputJsonValue } });
                reminded.push(a.slug);
            } catch (e) {
                console.error("[cron/expiry] store reminder failed", a.slug, e);
            }
            continue;
        }
        // Keep the academy's local_license/expirydate in sync with validUntil (as
        // YYYY-MM-DD, UTC) every run, so the in-academy banner always matches —
        // even when no reminder email is due.
        const d = a.validUntil;
        const expiryDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        try {
            await triggerExpiryReminder(a.slug, daysLeft, renewUrl, { expiryDate, sendEmail });
            if (sendEmail) {
                sent[`d${stage}`] = Date.now();
                await prisma.tenant.update({
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
    // Opt-in and conservative: only status='suspended' rows are eligible, so a
    // tenant must have already been expired + suspended by step (1); a renewed
    // one is 'live' again and never matches. autoDeleteDays was read above.
    const deleted: string[] = [];
    if (autoDeleteDays > 0) {
        const delCutoff = new Date(now - autoDeleteDays * 86_400_000);
        const toDelete = await prisma.tenant
            .findMany({
                where: { status: "suspended", validUntil: { not: null, lt: delCutoff } },
                select: { slug: true, product: true },
            })
            .catch((e) => { console.error("[cron/expiry] delete query failed", e); return []; });
        for (const a of toDelete) {
            try {
                if (a.product === "store") {
                    if (await deprovisionAndDeleteStore(a.slug)) deleted.push(a.slug);
                } else if (await deprovisionAndDeleteAcademy(a.slug)) {
                    deleted.push(a.slug);
                }
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

    // Weekly auto-renew health summary to Telegram (Mondays, UTC).
    if (new Date().getUTCDay() === 1) {
        await weeklyBillingSummary().catch((e) => console.error("[cron/expiry] weekly summary failed", e));
    }

    return NextResponse.json({ ok: true, graceDays, preRenew, billing, suspended, reminded, deleted, autoDeleteDays, expiredPayments });
}
