// Auto-renew billing engine. Charges due subscriptions off-session via a saved
// Kashier card token, extends the academy's term, and runs dunning on failure.
//
// DORMANT unless SUBSCRIPTIONS_ENABLED=1 — runBillingCycle() returns immediately
// while off, so wiring it into the daily cron is safe before the feature is live.
// See docs/subscriptions-auto-renew-plan.md.

import crypto from "crypto";
import prisma from "@/lib/prismaMysql";
import { decryptSecret } from "@/lib/secretBox";
import { notifyTelegram } from "@/lib/telegram";
import { triggerSuspend, triggerExpiryReminder } from "@/lib/provisionAcademy";
import { payWithToken } from "@/lib/kashierOrders";
import {
  subscriptionsEnabled, billingRetryDays, billingCycleKey,
  renewLeadDaysResolved, preRenewNoticeDaysResolved,
  billingCooldownHours, scheduleNextAttempt,
} from "@/lib/subscriptions";

/** True when a saved card is already expired, or expires on/before `by` (charge
 *  date). Cards are valid through the LAST day of their exp month. */
function cardExpiredBy(pm: { expMonth?: number | null; expYear?: number | null }, by: Date): boolean {
  if (!pm.expMonth || !pm.expYear) return false; // unknown → don't warn
  // First day of the month AFTER expiry = when the card stops working.
  const deadUtc = Date.UTC(pm.expYear, pm.expMonth, 1); // month is 1-based → this is the 1st of next month
  return deadUtc <= by.getTime();
}

export type BillingSummary = {
  skipped?: boolean; // feature off
  attempted: number;
  renewed: string[]; // slugs charged successfully
  failed: string[]; // slugs whose charge failed/declined
  needsAuth: string[]; // slugs where the acquirer forced a step-up (can't bill silently)
};

const DAY = 86_400_000;

/** Schedule the next retry from the ladder, or null once the ladder is exhausted
 *  (then the normal expiry/reminder/suspend flow takes over). */
function nextRetryAt(attemptCount: number): Date | null {
  const ladder = billingRetryDays();
  const idx = attemptCount - 1; // attemptCount already incremented for this failure
  if (idx < 0 || idx >= ladder.length) return null;
  return new Date(Date.now() + ladder[idx] * DAY);
}

/**
 * Charge every subscription due for renewal. `base` is a full origin used to build
 * the "renew now" link in dunning emails (the cron passes the request host).
 */
export async function runBillingCycle(base: string): Promise<BillingSummary> {
  const summary: BillingSummary = { attempted: 0, renewed: [], failed: [], needsAuth: [] };
  if (!subscriptionsEnabled()) return { ...summary, skipped: true };

  const lead = await renewLeadDaysResolved();
  const cooldownMs = billingCooldownHours() * 3600_000;
  const now = new Date();
  const due = await prisma.subscription
    .findMany({
      where: {
        status: { in: ["active", "past_due"] },
        autoRenew: true,
        nextAttemptAt: { not: null, lte: now },
      },
    })
    .catch((e) => { console.error("[billing] due query failed", e); return []; });

  for (const sub of due) {
    summary.attempted++;
    try {
      const cycle = billingCycleKey(sub.currentPeriodEnd);

      // Idempotency: never charge the same (subscription, cycle) twice.
      const already = await prisma.payment.findFirst({
        where: { subscriptionId: sub.id, billingCycle: cycle, status: "paid" },
        select: { id: true },
      });
      if (already) {
        // A charge already went through for this cycle — just advance the schedule.
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { nextAttemptAt: scheduleNextAttempt(sub.currentPeriodEnd, sub.intervalDays, lead) },
        });
        continue;
      }

      // Cooldown guard: refuse to charge if THIS subscription had a successful
      // charge within the cooldown window — a hard stop against any scheduling bug
      // (e.g. a mis-set lead) charging a card twice in quick succession.
      if (cooldownMs > 0) {
        const recent = await prisma.payment.findFirst({
          where: { subscriptionId: sub.id, status: "paid", paidAt: { gt: new Date(now.getTime() - cooldownMs) } },
          select: { paidAt: true },
        });
        if (recent) {
          console.warn(`[billing] cooldown: ${sub.academySlug} charged at ${recent.paidAt?.toISOString()} — skipping`);
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { nextAttemptAt: scheduleNextAttempt(sub.currentPeriodEnd, sub.intervalDays, lead) },
          });
          continue;
        }
      }

      const pm = sub.paymentMethodId
        ? await prisma.paymentMethod.findUnique({ where: { id: sub.paymentMethodId } })
        : await prisma.paymentMethod.findFirst({ where: { userId: sub.userId, isDefault: true } });
      const token = pm ? decryptSecret(pm.cardTokenEnc) : null;
      if (!pm || !token) {
        await markPastDue(sub.id, "no saved card token", 1);
        summary.failed.push(sub.academySlug);
        await notifyTelegram(`⚠️ Auto-renew: no saved card for ${sub.academySlug} — needs owner action`);
        continue;
      }

      const orderId = "sub_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      await prisma.payment.create({
        data: {
          orderId, userId: sub.userId, licenseKey: sub.licenseKey, purpose: "renew",
          amount: sub.amountEgp, currency: sub.currency, status: "pending",
          academySlug: sub.academySlug, subscriptionId: sub.id, billingCycle: cycle,
        },
      });

      const charge = await payWithToken({
        orderId, amount: sub.amountEgp, currency: sub.currency,
        customerReference: pm.customerReference, cardToken: token,
        webhookUrl: base ? `${base}/api/payments/kashier/webhook` : undefined,
      });

      if (charge.ok) {
        // Extend from the current period end (no drift); never leave it in the past.
        let newEnd = new Date(sub.currentPeriodEnd.getTime() + sub.intervalDays * DAY);
        if (newEnd.getTime() <= now.getTime()) newEnd = new Date(now.getTime() + sub.intervalDays * DAY);

        await prisma.payment.update({
          where: { orderId },
          data: { status: "paid", paidAt: new Date(), providerRef: charge.transactionId },
        });
        // Capture the card's expiry from the charge response (the callback never
        // gives it) so the card-expiry pre-warning can work next cycle.
        if (charge.expMonth && charge.expYear) {
          await prisma.paymentMethod.update({
            where: { id: pm.id }, data: { expMonth: charge.expMonth, expYear: charge.expYear },
          }).catch(() => {});
        }
        await prisma.academy.update({
          where: { slug: sub.academySlug },
          data: { status: "live", validUntil: newEnd, subscribedAt: now, expiryRemindersSent: {} },
        }).catch((e) => console.error("[billing] academy extend failed", sub.academySlug, e));
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: "active", currentPeriodEnd: newEnd, attemptCount: 0, lastError: null,
            nextAttemptAt: scheduleNextAttempt(newEnd, sub.intervalDays, lead),
            preRenewNotifiedAt: null, // new cycle → re-arm the heads-up
          },
        });
        // Sync the in-academy banner date + resume if it had lapsed into suspension.
        const ymd = `${newEnd.getUTCFullYear()}-${String(newEnd.getUTCMonth() + 1).padStart(2, "0")}-${String(newEnd.getUTCDate()).padStart(2, "0")}`;
        const daysLeft = Math.ceil((newEnd.getTime() - now.getTime()) / DAY);
        // One call: syncs the academy's expirydate (banner) AND emails a receipt
        // confirming the charge + the next renewal date.
        await triggerExpiryReminder(sub.academySlug, daysLeft, base ? `${base}/account` : "", {
          expiryDate: ymd, sendEmail: true, mode: "receipt", amountEgp: sub.amountEgp, cardLast4: pm.last4 ?? "",
          autoRenew: true,
        });
        await triggerSuspend(sub.academySlug, false);

        summary.renewed.push(sub.academySlug);
        await notifyTelegram(`💳 Auto-renewed ${sub.academySlug} → ${sub.licenseKey} (paid, next ${ymd})`);
        continue;
      }

      // ── Charge did not capture ──────────────────────────────────────────────
      const reason = charge.error || "declined";
      await prisma.payment.update({
        where: { orderId },
        data: { status: "failed", failureReason: reason.slice(0, 900) },
      }).catch(() => {});
      const attempt = sub.attemptCount + 1;
      const retryAt = nextRetryAt(attempt);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "past_due", attemptCount: attempt, lastError: reason.slice(0, 900), nextAttemptAt: retryAt },
      });

      // Dunning email (best-effort): a dedicated "we couldn't charge your card"
      // notice with the last-4 and a link to update it / renew. daysLeft from the
      // (still current) term.
      const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY);
      await triggerExpiryReminder(sub.academySlug, daysLeft, base ? `${base}/account` : "", {
        sendEmail: true, mode: "payment_failed", amountEgp: sub.amountEgp, cardLast4: pm.last4 ?? "",
      });

      if ((charge as any).needsAuth) {
        summary.needsAuth.push(sub.academySlug);
        await notifyTelegram(`🔐 Auto-renew needs 3DS/OTP — ${sub.academySlug}: charge card manually / owner must renew`);
      } else {
        summary.failed.push(sub.academySlug);
        await notifyTelegram(`⚠️ Auto-renew FAILED ${sub.academySlug} (attempt ${attempt}): ${reason}`);
      }
    } catch (e) {
      console.error("[billing] subscription attempt failed", sub.academySlug, e);
    }
  }

  return summary;
}

/** Open (or refresh) the auto-renew subscription for an academy after a paid term.
 *  Idempotent on academySlug. Links the user's default saved card if one exists;
 *  billing falls back to the default card by userId otherwise. No-op while the
 *  feature is off. Called from the webhook once a paid term's validUntil is known. */
export async function openSubscription(opts: {
  academySlug: string;
  userId: string;
  licenseKey: string;
  intervalDays: number;
  amountEgp: number;
  currency: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  if (!subscriptionsEnabled()) return;
  if (!opts.intervalDays || opts.intervalDays <= 0) return; // never-expiring plan: nothing to renew
  const nextAttemptAt = scheduleNextAttempt(opts.currentPeriodEnd, opts.intervalDays, await renewLeadDaysResolved());
  const pm = await prisma.paymentMethod
    .findFirst({ where: { userId: opts.userId, isDefault: true }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  try {
    await prisma.subscription.upsert({
      where: { academySlug: opts.academySlug },
      create: {
        academySlug: opts.academySlug, userId: opts.userId, licenseKey: opts.licenseKey,
        status: "active", autoRenew: true, intervalDays: opts.intervalDays,
        amountEgp: opts.amountEgp, currency: opts.currency,
        currentPeriodEnd: opts.currentPeriodEnd, nextAttemptAt,
        attemptCount: 0, consentAt: new Date(), paymentMethodId: pm?.id ?? null,
      },
      update: {
        // A fresh paid term (renewal / plan change) re-arms billing.
        licenseKey: opts.licenseKey, status: "active", autoRenew: true,
        intervalDays: opts.intervalDays, amountEgp: opts.amountEgp, currency: opts.currency,
        currentPeriodEnd: opts.currentPeriodEnd, nextAttemptAt, attemptCount: 0, lastError: null,
        preRenewNotifiedAt: null,
        ...(pm?.id ? { paymentMethodId: pm.id } : {}),
      },
    });
    // Tell the academy it's auto-renewing (banner shows "renews on <date>").
    const d = opts.currentPeriodEnd;
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    await triggerExpiryReminder(opts.academySlug, 0, "", { sendEmail: false, expiryDate: ymd, autoRenew: true });
  } catch (e) {
    console.error("[billing] openSubscription failed", opts.academySlug, e);
  }
}

/**
 * Email owners a heads-up BEFORE the auto-charge ("card ****1234 will be charged
 * X EGP in N days"), once per cycle. Runs before the charge pass. No-op while the
 * feature is off or PRE_RENEW_NOTICE_DAYS=0.
 */
export async function runPreRenewNotices(base: string): Promise<{ notified: string[] } | { skipped: true }> {
  if (!subscriptionsEnabled()) return { skipped: true };
  const noticeDays = await preRenewNoticeDaysResolved();
  if (noticeDays <= 0) return { notified: [] };

  const now = Date.now();
  const windowEnd = new Date(now + noticeDays * DAY);
  const due = await prisma.subscription
    .findMany({
      where: {
        status: "active", autoRenew: true,
        preRenewNotifiedAt: null,
        nextAttemptAt: { not: null, gt: new Date(now), lte: windowEnd },
      },
    })
    .catch((e) => { console.error("[billing] pre-renew query failed", e); return []; });

  const notified: string[] = [];
  for (const sub of due) {
    try {
      const pm = sub.paymentMethodId
        ? await prisma.paymentMethod.findUnique({ where: { id: sub.paymentMethodId } })
        : await prisma.paymentMethod.findFirst({ where: { userId: sub.userId, isDefault: true } });
      const daysLeft = Math.max(0, Math.ceil((sub.nextAttemptAt!.getTime() - now) / DAY));
      // If the saved card will be expired by the charge date, the heads-up becomes
      // an "update your card or the renewal will fail" warning instead.
      const cardExpiring = !!pm && cardExpiredBy(pm, sub.nextAttemptAt!);
      await triggerExpiryReminder(sub.academySlug, daysLeft, base ? `${base}/account` : "", {
        sendEmail: true, mode: "prerenew", amountEgp: sub.amountEgp, cardLast4: pm?.last4 ?? "",
        cardExpiring,
      });
      await prisma.subscription.update({ where: { id: sub.id }, data: { preRenewNotifiedAt: new Date() } });
      notified.push(sub.academySlug);
    } catch (e) {
      console.error("[billing] pre-renew notice failed", sub.academySlug, e);
    }
  }
  return { notified };
}

/** Post a one-line auto-renew health summary to Telegram (active / past-due /
 *  cancelled + estimated MRR). The cron calls this weekly. No-op while off. */
export async function weeklyBillingSummary(): Promise<{ posted: boolean }> {
  if (!subscriptionsEnabled()) return { posted: false };
  const subs = await prisma.subscription
    .findMany({ select: { status: true, autoRenew: true, amountEgp: true, intervalDays: true } })
    .catch(() => []);
  if (!subs.length) return { posted: false };
  const active = subs.filter((s) => s.autoRenew && s.status === "active").length;
  const pastDue = subs.filter((s) => s.status === "past_due").length;
  const canceled = subs.filter((s) => !s.autoRenew || s.status === "canceled").length;
  const mrr = Math.round(
    subs.filter((s) => s.autoRenew && s.status !== "canceled")
      .reduce((a, s) => a + (s.amountEgp || 0) / ((s.intervalDays || 30) >= 365 ? 12 : 1), 0),
  );
  await notifyTelegram(
    `📊 Auto-renew weekly — ${active} active · ${pastDue} past-due · ${canceled} cancelled · ~${mrr} EGP MRR`,
  );
  return { posted: true };
}

async function markPastDue(id: string, reason: string, attempt: number): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: { status: "past_due", lastError: reason, attemptCount: attempt, nextAttemptAt: nextRetryAt(attempt) },
  }).catch(() => {});
}
