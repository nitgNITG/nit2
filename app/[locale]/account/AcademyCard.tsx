'use client'

import React, { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export type ClientAcademy = { id: string; name: string; slug: string; status: string; createdAt: string }

export default function AcademyCard({ academy, domain }: { academy: ClientAcademy; domain: string }) {
    const t = useTranslations('Dashboard')
    const [live, setLive] = useState(academy.status === 'live')
    const url = `https://${academy.slug}.${domain}`

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
                <a
                    href={url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2923] px-4 py-2 text-sm font-bold text-[#00FFB2] hover:bg-[#0e3329] transition-colors'
                >
                    {t('openPlatform')} ↗
                </a>
            ) : (
                <div className='mt-1 rounded-lg bg-[#E8A13C]/10 px-4 py-2 text-sm text-[#b9791f] text-center'>
                    {t('preparingHint')}
                </div>
            )}
        </div>
    )
}
