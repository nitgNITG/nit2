// Auto-renew subscriptions feature flag + shared helpers.
//
// The whole recurring-billing feature is DORMANT unless SUBSCRIPTIONS_ENABLED=1.
// While off: no card token is captured, no Subscription row is opened, and the
// billing cron step is a no-op — the platform behaves exactly as before. Turn it
// on only once the Kashier pay-with-token specifics (see
// docs/subscriptions-auto-renew-plan.md §9) are confirmed on a live test order.

export function subscriptionsEnabled(): boolean {
  const v = (process.env.SUBSCRIPTIONS_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Days before period-end to attempt the auto-renew charge (0 = charge on expiry). */
export function renewLeadDays(): number {
  return Math.max(0, Number(process.env.RENEW_LEAD_DAYS ?? 0) || 0);
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
