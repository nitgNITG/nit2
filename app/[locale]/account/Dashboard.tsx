'use client'

import React from 'react'
import { Link, useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'
import AcademyCard, { ClientAcademy } from './AcademyCard'

type DashUser = { name: string | null; email: string; role: string }

export default function Dashboard({
    user, academies, domain,
}: { user: DashUser; academies: ClientAcademy[]; domain: string }) {
    const t = useTranslations('Dashboard')
    const router = useRouter()

    const logout = async () => {
        try { await fetch('/api/logout', { method: 'POST' }) } catch { /* ignore */ }
        router.push('/account')
        router.refresh()
    }

    return (
        <div className='min-h-svh bg-[#0B2923] text-white'>
            <div className='mx-auto max-w-6xl px-5 sm:px-8 py-8'>

                {/* Top bar */}
                <header className='flex items-center justify-between gap-4'>
                    <div>
                        <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/70'>NIT · Academy</span>
                        <h1 className='mt-1 text-2xl font-extrabold'>{t('title')}</h1>
                    </div>
                    <div className='flex items-center gap-4'>
                        <span className='hidden sm:block text-sm text-white/60'>{user.name || user.email}</span>
                        <button onClick={logout} className='text-sm font-bold text-white/70 hover:text-white transition-colors'>
                            {t('logout')}
                        </button>
                    </div>
                </header>

                {/* Action bar */}
                <div className='mt-6 flex items-center justify-between gap-4'>
                    <p className='text-sm text-white/50'>
                        {academies.length ? t('count', { n: academies.length }) : ''}
                    </p>
                    <Link
                        href='/build-product'
                        className='rounded-full bg-[#00FFB2] px-5 py-2.5 text-sm font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform'
                    >
                        + {t('newAcademy')}
                    </Link>
                </div>

                {/* Console */}
                {academies.length === 0 ? (
                    <div className='mt-10 rounded-3xl border border-dashed border-white/15 p-12 text-center'>
                        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00FFB2]/10 text-2xl'>🚀</div>
                        <h2 className='mt-4 text-xl font-extrabold'>{t('emptyTitle')}</h2>
                        <p className='mt-2 text-white/60 max-w-sm mx-auto'>{t('emptyBody')}</p>
                        <Link
                            href='/build-product'
                            className='mt-6 inline-block rounded-full bg-[#00FFB2] px-6 py-3 font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform'
                        >
                            {t('emptyCta')}
                        </Link>
                    </div>
                ) : (
                    <div className='mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {academies.map((a) => <AcademyCard key={a.id} academy={a} domain={domain} />)}
                    </div>
                )}
            </div>
        </div>
    )
}
