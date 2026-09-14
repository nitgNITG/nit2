'use client'

import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useLocale } from 'next-intl'
import LocaleLink from '../components/LocaleLink'

type License = {
    key: string; name: string; active: boolean; contactSales?: boolean
    priceEgp?: number; priceEgpMonthly?: number; durationDays?: number
    maxCourses?: number; maxTeachers?: number; storageGb?: number; videoSource?: string
    features?: Record<string, boolean>; order?: number
}

const FEATURE_LABELS: Record<string, { ar: string; en: string }> = {
    drm: { ar: 'فيديو محمي (DRM)', en: 'Protected video (DRM)' },
    coupons: { ar: 'كوبونات الخصم', en: 'Discount coupons' },
    offers: { ar: 'العروض', en: 'Offers' },
    subscriptions: { ar: 'الاشتراكات', en: 'Subscriptions' },
    packages: { ar: 'الباقات', en: 'Course bundles' },
    jitsi: { ar: 'الحصص المباشرة', en: 'Live sessions' },
}

const cap = (n?: number, unlimited?: string) => ((n ?? -1) < 0 ? (unlimited ?? '∞') : String(n))

export default function PricingPlans() {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const [licenses, setLicenses] = useState<License[]>([])
    const [loading, setLoading] = useState(true)
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual')

    useEffect(() => {
        axios.get('/api/licenses')
            .then((r) => setLicenses((r.data.licenses ?? []).filter((l: License) => l.active)))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const plans = useMemo(
        () => [...licenses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.priceEgp ?? 0) - (b.priceEgp ?? 0)),
        [licenses],
    )
    // Highlight the middle BUYABLE plan as "most popular" (Hostinger pattern).
    const buyableKeys = plans.filter((p) => !p.contactSales).map((p) => p.key)
    const popularKey = buyableKeys[Math.floor((buyableKeys.length - 1) / 2)] ?? ''

    const anyMonthly = plans.some((p) => (p.priceEgpMonthly ?? 0) > 0)

    if (loading) return <p className='text-center text-gray-400 py-10'>{tr('جارٍ التحميل…', 'Loading…')}</p>
    if (!plans.length) return null

    return (
        <div className='space-y-8'>
            {/* Monthly / Annual toggle */}
            {anyMonthly && (
                <div className='flex justify-center'>
                    <div className='inline-flex rounded-full border border-[#0B2923]/10 bg-white p-1 text-sm'>
                        {(['monthly', 'annual'] as const).map((c) => (
                            <button key={c} type='button' onClick={() => setCycle(c)}
                                className={`rounded-full px-5 py-1.5 font-bold transition-colors ${cycle === c ? 'bg-[#1E7D67] text-white' : 'text-gray-600 hover:text-[#0B2923]'}`}>
                                {c === 'monthly' ? tr('شهري', 'Monthly') : tr('سنوي', 'Annual')}
                                {c === 'annual' && <span className='ms-1.5 rounded-full bg-[#00c98e]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#0b8f66]'>{tr('وفّر', 'save')}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
                {plans.map((p) => {
                    const contact = !!p.contactSales
                    const popular = p.key === popularKey
                    const paid = (p.priceEgp ?? 0) > 0
                    const hasMonthly = (p.priceEgpMonthly ?? 0) > 0
                    const useMonthly = cycle === 'monthly' && hasMonthly
                    const price = useMonthly ? (p.priceEgpMonthly ?? 0) : (p.priceEgp ?? 0)
                    const per = useMonthly ? tr('/شهر', '/mo') : tr('/سنة', '/yr')
                    // Annual savings vs 12× the monthly price.
                    const savePct = paid && hasMonthly && (p.priceEgpMonthly ?? 0) > 0
                        ? Math.max(0, Math.round((1 - (p.priceEgp ?? 0) / ((p.priceEgpMonthly ?? 0) * 12)) * 100))
                        : 0
                    const feats = Object.keys(p.features || {}).filter((f) => p.features?.[f])

                    const specs: string[] = [
                        `${tr('الكورسات', 'Courses')}: ${cap(p.maxCourses, tr('غير محدود', 'Unlimited'))}`,
                        `${tr('المدرّسون', 'Teachers')}: ${cap(p.maxTeachers, tr('غير محدود', 'Unlimited'))}`,
                        `${tr('التخزين', 'Storage')}: ${p.storageGb ?? 1} GB`,
                        ...(p.videoSource ? [`${tr('الفيديو', 'Video')}: ${p.videoSource}`] : []),
                        ...feats.map((f) => (isAr ? FEATURE_LABELS[f]?.ar : FEATURE_LABELS[f]?.en) ?? f),
                    ]

                    return (
                        <div key={p.key}
                            className={`relative flex flex-col rounded-2xl border bg-white p-6 ${popular ? 'border-[#1E7D67] shadow-xl shadow-[#1E7D67]/10 md:-translate-y-2' : 'border-gray-200 shadow-sm'}`}>
                            {popular && (
                                <span className='absolute -top-3 start-6 rounded-full bg-[#1E7D67] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white'>
                                    {tr('الأكثر طلباً', 'Most popular')}
                                </span>
                            )}
                            {contact && (
                                <span className='absolute -top-3 start-6 rounded-full bg-[#0B2923] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white'>
                                    {tr('مخصّص', 'Custom')}
                                </span>
                            )}

                            <h3 className='text-lg font-bold text-[#0B2923]'>{p.name}</h3>

                            {/* Price */}
                            <div className='mt-3 min-h-[56px]' dir='ltr'>
                                {contact ? (
                                    <div className='text-2xl font-extrabold text-[#0B2923]'>{tr('حسب الطلب', 'Let’s talk')}</div>
                                ) : paid ? (
                                    <div className='flex items-end gap-1'>
                                        <span className='text-3xl font-extrabold text-[#0B2923]'>{price.toLocaleString()}</span>
                                        <span className='text-sm font-semibold text-gray-500'>{isAr ? 'ج.م' : 'EGP'}{per}</span>
                                    </div>
                                ) : (
                                    <div className='text-3xl font-extrabold text-[#1E7D67]'>{tr('مجاني', 'Free')}</div>
                                )}
                                {savePct > 0 && cycle === 'annual' && (
                                    <p className='text-xs font-semibold text-[#0b8f66]'>{tr(`وفّر ${savePct}٪ سنوياً`, `Save ${savePct}% yearly`)}</p>
                                )}
                                {cycle === 'monthly' && paid && !hasMonthly && (
                                    <p className='text-xs text-gray-400'>{tr('سنوي فقط', 'annual only')}</p>
                                )}
                            </div>

                            {/* CTA */}
                            {contact ? (
                                <LocaleLink href={`/contact?plan=${p.key}`}
                                    className='mt-4 block rounded-xl border-2 border-[#0B2923] py-2.5 text-center text-sm font-bold text-[#0B2923] transition-colors hover:bg-[#0B2923] hover:text-white'>
                                    {tr('تواصل معنا', 'Contact us')}
                                </LocaleLink>
                            ) : (
                                <LocaleLink href={`/build-product?tier=${p.key}&cycle=${cycle}`}
                                    className={`mt-4 block rounded-xl py-2.5 text-center text-sm font-bold transition-colors ${popular ? 'bg-[#1E7D67] text-white hover:bg-[#186655]' : 'border-2 border-[#1E7D67] text-[#1E7D67] hover:bg-[#1E7D67] hover:text-white'}`}>
                                    {paid ? tr('اختر الباقة', 'Choose plan') : tr('ابدأ مجاناً', 'Start free')}
                                </LocaleLink>
                            )}

                            {/* Feature / spec list */}
                            <ul className='mt-5 space-y-2 text-sm text-gray-600'>
                                {specs.map((s, i) => (
                                    <li key={i} className='flex items-start gap-2'>
                                        <span className='mt-0.5 text-[#1E7D67]'>✓</span>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                })}
            </div>

            <p className='text-center text-xs text-gray-400'>
                {tr('كل الأسعار بالجنيه المصري وتشمل الاستضافة والتحديثات. يمكنك الترقية في أي وقت.',
                    'All prices in EGP and include hosting & updates. Upgrade anytime.')}
            </p>
        </div>
    )
}
