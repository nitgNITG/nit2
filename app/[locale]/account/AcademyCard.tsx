'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { connectLinks } from '@/lib/connectLinks'
import DeletePlatformButton from './DeletePlatformButton'

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export type ClientAcademy = { id: string; name: string; slug: string; status: string; createdAt: string }

export default function AcademyCard({ academy, domain }: { academy: ClientAcademy; domain: string }) {
    const t = useTranslations('Dashboard')
    const [live, setLive] = useState(academy.status === 'live')
    const [qr, setQr] = useState<string>('')
    const links = connectLinks(academy.slug, domain)

    // While the site is still being prepared, poll until it answers 200.
    useEffect(() => {
        if (live) return
        let stopped = false
        let attempts = 0
        const check = async () => {
            attempts++
            try {
                const res = await fetch(`/api/academies/${academy.slug}/status`, { cache: 'no-store' })
                const data = await res.json()
                if (!stopped && data.live) { setLive(true); return }
            } catch { /* keep trying */ }
            if (!stopped && attempts < 40) setTimeout(check, 8000)
        }
        const first = setTimeout(check, 3000)
        return () => { stopped = true; clearTimeout(first) }
    }, [live, academy.slug])

    // QR encodes the deep link (per TENANT_CONNECT_LINKS.md). Built client-side once live.
    useEffect(() => {
        if (!live) return
        let cancelled = false
        import('qrcode')
            .then(({ default: QRCode }) => QRCode.toDataURL(links.deeplink, { margin: 1, width: 264 }))
            .then((dataUrl) => { if (!cancelled) setQr(dataUrl) })
            .catch(() => { /* QR is best-effort — the buttons + URL still work */ })
        return () => { cancelled = true }
    }, [live, links.deeplink])

    return (
        <div className='rounded-2xl bg-[#F5F3EE] ring-1 ring-black/5 p-5 flex flex-col gap-3 shadow-sm'>
            <div className='flex items-center gap-2'>
                {live ? (
                    <span className='relative flex h-2.5 w-2.5'>
                        <span className='absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60 animate-ping motion-reduce:hidden' />
                        <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00c98e]' />
                    </span>
                ) : (
                    <span className='h-2.5 w-2.5 rounded-full bg-[#E8A13C] animate-pulse motion-reduce:animate-none' />
                )}
                <span className={`text-xs font-bold ${live ? 'text-[#0b8f66]' : 'text-[#b9791f]'}`}>
                    {live ? t('statusLive') : t('statusPreparing')}
                </span>
            </div>

            <div>
                <p className='text-lg font-extrabold text-[#0B2923]'>{academy.name}</p>
                <p dir='ltr' className='mt-0.5 text-xs text-[#0B2923]/50 truncate' style={{ fontFamily: MONO }}>
                    {academy.slug}.{domain}
                </p>
            </div>

            {live ? (
                <div className='mt-1 flex flex-col gap-3'>
                    <a
                        href={links.site}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2923] px-4 py-2 text-sm font-bold text-[#00FFB2] hover:bg-[#0e3329] transition-colors'
                    >
                        {t('openPlatform')} ↗
                    </a>

                    {/* App connect links — opens the NIT Academy app pointed at this academy. */}
                    <div className='rounded-xl bg-white ring-1 ring-black/5 p-4 flex flex-col items-center gap-3'>
                        <p className='text-xs font-bold text-[#0B2923]'>{t('appLinksTitle')}</p>

                        {qr ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qr} alt='' width={132} height={132} className='rounded-lg' />
                        ) : (
                            <div className='h-[132px] w-[132px] rounded-lg bg-black/5 animate-pulse' />
                        )}
                        <p className='text-[11px] text-[#0B2923]/50 text-center'>{t('scanHint')}</p>

                        <div className='flex w-full flex-col gap-2'>
                            <a
                                href={links.playUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0B2923]/15 px-3 py-2 text-xs font-semibold text-[#0B2923] hover:bg-black/5 transition-colors'
                            >
                                ▶ {t('getOnPlay')}
                            </a>
                            <a
                                href={links.deeplink}
                                className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0B2923]/15 px-3 py-2 text-xs font-semibold text-[#0B2923] hover:bg-black/5 transition-colors'
                            >
                                📱 {t('openInApp')}
                            </a>
                        </div>

                        <div className='w-full'>
                            <p className='text-[11px] text-[#0B2923]/50 mb-1'>{t('orAddress')}</p>
                            <code
                                dir='ltr'
                                className='block w-full select-all rounded-md bg-black/5 px-2 py-1.5 text-[11px] text-[#0B2923] break-all'
                                style={{ fontFamily: MONO }}
                            >
                                {links.site}
                            </code>
                        </div>
                    </div>
                </div>
            ) : (
                <div className='mt-1 rounded-lg bg-[#E8A13C]/10 px-4 py-2 text-sm text-[#b9791f] text-center'>
                    {t('preparingHint')}
                </div>
            )}

            {/* Owner action: delete this academy (confirm dialog inside). */}
            <div className='mt-auto flex justify-end border-t border-black/5 pt-3'>
                <DeletePlatformButton
                    slug={academy.slug}
                    name={academy.name}
                    triggerClassName='inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-500/10 transition-colors'
                />
            </div>
        </div>
    )
}
