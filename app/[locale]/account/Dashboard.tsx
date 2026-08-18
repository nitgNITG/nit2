'use client'

import React, { useState } from 'react'
import { useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'
import AcademyCard, { ClientAcademy } from './AcademyCard'
import BuildProductForm from '../build-product/BuildProductForm'

type DashUser = { name: string | null; email: string; role: string }

export default function Dashboard({
    user, academies, domain,
}: { user: DashUser; academies: ClientAcademy[]; domain: string }) {
    const t = useTranslations('Dashboard')
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)

    const onCreated = () => {
        setShowCreate(false)
        router.refresh() // pull the new academy into the list
    }

    return (
        <div className='bg-[#0B2923] text-white'>
            <div className='mx-auto max-w-6xl px-5 sm:px-8 py-10'>

                {/* Title (account controls live in the navbar) */}
                <header>
                    <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/70'>
                        {t('greeting', { name: user.name || user.email })}
                    </span>
                    <h1 className='mt-1 text-2xl font-extrabold'>{t('title')}</h1>
                </header>

                {/* Action bar */}
                <div className='mt-6 flex items-center justify-between gap-4'>
                    <p className='text-sm text-white/50'>
                        {academies.length ? t('count', { n: academies.length }) : ''}
                    </p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className='rounded-full bg-[#00FFB2] px-5 py-2.5 text-sm font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform'
                    >
                        + {t('newAcademy')}
                    </button>
                </div>

                {/* Console */}
                {academies.length === 0 ? (
                    <div className='mt-10 rounded-3xl border border-dashed border-white/15 p-12 text-center'>
                        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00FFB2]/10 text-2xl'>🚀</div>
                        <h2 className='mt-4 text-xl font-extrabold'>{t('emptyTitle')}</h2>
                        <p className='mt-2 text-white/60 max-w-sm mx-auto'>{t('emptyBody')}</p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className='mt-6 inline-block rounded-full bg-[#00FFB2] px-6 py-3 font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform'
                        >
                            {t('emptyCta')}
                        </button>
                    </div>
                ) : (
                    <div className='mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {academies.map((a) => <AcademyCard key={a.id} academy={a} domain={domain} />)}
                    </div>
                )}
            </div>

            {/* Create modal — building happens right here, no page jump */}
            {showCreate && (
                <div
                    className='fixed inset-0 z-[100000] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10'
                    onClick={() => setShowCreate(false)}
                >
                    <div className='relative w-full max-w-xl' onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setShowCreate(false)}
                            aria-label='Close'
                            className='absolute -top-3 end-0 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0B2923] shadow-lg hover:bg-gray-100'
                        >
                            ✕
                        </button>
                        <BuildProductForm onSuccess={onCreated} />
                    </div>
                </div>
            )}
        </div>
    )
}
