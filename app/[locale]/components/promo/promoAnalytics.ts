'use client'
// Promo analytics (spec §7). There is no analytics SDK in the app, so events go to
// window.dataLayer (GTM) and window.gtag when present — both no-ops otherwise.

export type PromoEvent =
    | 'promo_teaser_view'
    | 'promo_open'
    | 'promo_progress_25'
    | 'promo_progress_50'
    | 'promo_progress_75'
    | 'promo_complete'
    | 'promo_cta_click';

type W = Window & { dataLayer?: Record<string, unknown>[]; gtag?: (...a: unknown[]) => void };

export function trackPromo(event: PromoEvent, projectSlug: string, page: string) {
    if (typeof window === 'undefined') return;
    const w = window as W;
    const params = { project_slug: projectSlug, page };
    try {
        w.dataLayer?.push({ event, ...params });
        w.gtag?.('event', event, params);
    } catch {
        /* analytics must never break the page */
    }
}
