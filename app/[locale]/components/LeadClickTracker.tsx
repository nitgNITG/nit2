'use client';
import { useEffect } from 'react';
import { isPrivatePath, leadTypeForHref, trackLead } from '@/lib/leadTracking';

/**
 * Records every WhatsApp (wa.me / api.whatsapp.com) and tel: link click on the
 * public site — the floating button, header/FAQ/pricing CTAs, the article CTA box,
 * and any added later — with one delegated listener, so no link needs touching.
 * A link inside `data-lead-ignore` is skipped (it is not a new lead).
 * Capture phase, so a component that stops propagation can't hide the click.
 * Mounted once in app/[locale]/layout.tsx. Renders nothing.
 */
export default function LeadClickTracker() {
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.type === 'auxclick' && e.button !== 1) return; // middle-click opens a tab; right-click doesn't
            const link = (e.target as Element | null)?.closest?.('a[href]');
            if (!link || isPrivatePath(window.location.pathname)) return;
            if (link.closest('[data-lead-ignore]')) return; // e.g. the contact form's WhatsApp verification button
            const type = leadTypeForHref(link.getAttribute('href') ?? '');
            if (type) trackLead(type);
        };
        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);
        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('auxclick', onClick, true);
        };
    }, []);
    return null;
}
