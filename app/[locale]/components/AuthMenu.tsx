'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import LocalLink from './LocaleLink'

type Me = { name: string | null; email: string; role: string } | null

export default function AuthMenu({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
    const t = useTranslations('Navbar')
    const locale = useLocale()
    const [me, setMe] = useState<Me | undefined>(undefined) // undefined = still loading
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let stop = false
        fetch('/api/me', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => { if (!stop) setMe(d.user ?? null) })
            .catch(() => { if (!stop) setMe(null) })
        return () => { stop = true }
    }, [])

    useEffect(() => {
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    const logout = async () => {
        try { await fetch('/api/logout', { method: 'POST' }) } catch { /* ignore */ }
        window.location.href = `/${locale}`
    }

    // Loading — reserve space, don't flash the wrong state.
    if (me === undefined) return <span className={mobile ? '' : 'inline-block w-8 h-8'} aria-hidden />

    // Signed out → a single "log in" entry.
    if (!me) {
        return (
            <LocalLink
                href='/account'
                onClick={onNavigate}
                className={mobile
                    ? 'block w-fit font-semibold text-xl text-[#00FFB2]'
                    : 'px-3 py-1.5 rounded-full text-sm 2xl:text-base font-bold text-[#0B2923] whitespace-nowrap hover:bg-[#1E7D67]/5'}
            >
                {t('login')}
            </LocalLink>
        )
    }

    const initial = (me.name || me.email || '?').trim().charAt(0).toUpperCase()

    // Mobile: inline stack (the drawer already lists things vertically).
    if (mobile) {
        return (
            <div className='flex flex-col items-center gap-3'>
                <span className='text-white/60 text-sm'>{me.name || me.email}</span>
                {me.role === 'admin' && (
                    <LocalLink onClick={onNavigate} href='/dashboard' className='font-semibold text-xl text-[#00FFB2]'>{t('adminPanel')}</LocalLink>
                )}
                <LocalLink onClick={onNavigate} href='/account' className='font-semibold text-xl text-[#00FFB2]'>{t('myPlatforms')}</LocalLink>
                <button onClick={logout} className='font-semibold text-lg text-red-300'>{t('logout')}</button>
            </div>
        )
    }

    // Desktop: avatar button + dropdown.
    return (
        <div className='relative' ref={ref}>
            <button
                type='button'
                onClick={() => setOpen((v) => !v)}
                aria-haspopup='true'
                aria-expanded={open}
                className='flex items-center gap-2 rounded-full bg-[#0B2923] py-1 ps-1 pe-3'
            >
                <span className='flex h-7 w-7 items-center justify-center rounded-full bg-[#00FFB2] text-sm font-extrabold text-[#0B2923]'>{initial}</span>
                <span className='max-w-[90px] truncate text-sm font-bold text-white'>{me.name || me.email}</span>
                <span className={`text-[10px] text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div
                    className='absolute top-full mt-2 min-w-[12rem] rounded-xl bg-white p-1.5 shadow-2xl ring-1 ring-black/5 z-[999999]'
                    style={{ insetInlineEnd: 0 }}
                >
                    {me.role === 'admin' && (
                        <LocalLink href='/dashboard' onClick={() => setOpen(false)} className='block rounded-lg px-3 py-2 text-sm font-semibold text-[#0B2923] hover:bg-[#1E7D67]/5'>
                            {t('adminPanel')}
                        </LocalLink>
                    )}
                    <LocalLink href='/account' onClick={() => setOpen(false)} className='block rounded-lg px-3 py-2 text-sm font-semibold text-[#0B2923] hover:bg-[#1E7D67]/5'>
                        {t('myPlatforms')}
                    </LocalLink>
                    <button onClick={logout} className='block w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-red-600 hover:bg-red-50'>
                        {t('logout')}
                    </button>
                </div>
            )}
        </div>
    )
}
