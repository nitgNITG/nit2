'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { isPrivatePath } from '@/lib/leadTracking';
import { gaBootstrapScript, gaMeasurementId } from '@/lib/seoIntegrations';

/**
 * Google Analytics 4 with Consent Mode v2 defaults (see lib/seoIntegrations.ts).
 * Renders nothing without a valid G- id, and nothing on the signed-in pages
 * (dashboard / account / payment). If gtag.js was already loaded on a public page
 * and the visitor moves into a private one, `ga-disable-<id>` stops it sending —
 * set during render so it is in place before the router's history update, which is
 * what GA's enhanced measurement listens to for SPA page views.
 * Mounted once in app/[locale]/layout.tsx.
 */
export default function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
    const id = gaMeasurementId(measurementId);
    const isPrivate = isPrivatePath(usePathname() ?? '');
    if (id && typeof window !== 'undefined') {
        (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = isPrivate;
    }
    if (!id || isPrivate) return null;
    return (
        <>
            <Script id="ga4-consent-config" strategy="afterInteractive">
                {gaBootstrapScript(id)}
            </Script>
            <Script id="ga4-gtag" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
        </>
    );
}
