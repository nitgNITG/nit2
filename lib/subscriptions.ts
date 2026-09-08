// Auto-renew subscriptions feature flag + shared helpers.
//
// The whole recurring-billing feature is DORMANT unless SUBSCRIPTIONS_ENABLED=1.
// While off: no card token is captured, no Subscription row is opened, and the
// billing cron step is a no-op — the platform behaves exactly as before. Turn it
// on only once the Kashier pay-with-token specifics (see
// docs/subscriptions-auto-renew-plan.md §9) are confirmed on a live test order.

import prisma from "@/lib/prismaMysql";

export function subscriptionsEnabled(): boolean {
  const v = (process.env.SUBSCRIPTIONS_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Days before period-end to attempt the auto-renew charge (0 = charge on expiry). */
export function renewLeadDays(): number {
  return Math.max(0, Number(process.env.RENEW_LEAD_DAYS ?? 0) || 0);
}

/** Days before the auto-charge to email the owner a heads-up. Default 3. 0 = off. */
export function preRenewNoticeDays(): number {
  return Math.max(0, Number(process.env.PRE_RENEW_NOTICE_DAYS ?? 3) || 0);
}

// Platform-setting override with env fallback. The dashboard (Lifecycle group) can
// set these without a redeploy; a blank/invalid value falls back to the env default.
async function settingInt(key: string, fallback: number): Promise<number> {
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    const raw = (row?.value ?? "").trim();
    if (raw === "") return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Pre-renew heads-up days, dashboard-overridable (pre_renew_notice_days). */
export function preRenewNoticeDaysResolved(): Promise<number> {
  return settingInt("pre_renew_notice_days", preRenewNoticeDays());
}

/** Charge-lead days, dashboard-overridable (renew_lead_days). */
export function renewLeadDaysResolved(): Promise<number> {
  return settingInt("renew_lead_days", renewLeadDays());
}

/** Retry ladder (days after a failed attempt) for dunning. Default 1,3,5. */
export function billingRetryDays(): number[] {
  const raw = (process.env.BILLING_RETRY_DAYS || "1,3,5").trim();
  const days = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return days.length ? days : [1, 3, 5];
}

/** Billing-cycle key for a period end, e.g. "2026-10" — used to dedupe retries so a
 *  cycle is charged at most once regardless of how many times the cron runs. */
export function billingCycleKey(periodEnd: Date): string {
  return `${periodEnd.getUTCFullYear()}-${String(periodEnd.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Min hours between two successful charges on the same subscription — a hard
 *  belt-and-suspenders guard against any scheduling bug charging a card twice in
 *  quick succession. Default 12h. */
export function billingCooldownHours(): number {
  return Math.max(0, Number(process.env.BILLING_COOLDOWN_HOURS ?? 12) || 0);
}

/** Next-charge date = periodEnd − lead, with lead CLAMPED to < interval so we can
 *  never bill more than one interval early. This makes a mis-set renew_lead_days
 *  (e.g. 90 on a 30-day plan) harmless: the next attempt always lands in the future
 *  relative to a freshly-extended term, instead of in the past (runaway charges). */
export function scheduleNextAttempt(periodEnd: Date, intervalDays: number, lead: number): Date {
  const effLead = Math.min(Math.max(0, lead), Math.max(0, intervalDays - 1));
  return new Date(periodEnd.getTime() - effLead * 86_400_000);
}
