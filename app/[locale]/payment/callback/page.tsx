'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import LocaleLink from '../../components/LocaleLink'

type Status = 'pending' | 'paid' | 'failed' | 'error'

export default function PaymentCallbackPage() {
    return (
        <Suspense fallback={<div className='min-h-[70vh]' />}>
            <PaymentCallbackInner />
        </Suspense>
    )
}

function PaymentCallbackInner() {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const params = useSearchParams()
    const orderId = params.get('order') || ''
    const [status, setStatus] = useState<Status>('pending')
    const [slug, setSlug] = useState<string | null>(null)

    useEffect(() => {
        if (!orderId) { setStatus('error'); return }
        let stop = false
        let tries = 0
        const tick = async () => {
            if (stop) return
            tries++
            try {
                const r = await fetch(`/api/payments/${orderId}`, { cache: 'no-store' })
                const d = await r.json()
                if (!r.ok) { setStatus('error'); return }
                setSlug(d.academySlug ?? null)
                if (d.status === 'paid') { setStatus('paid'); return }
                if (d.status === 'failed') { setStatus('failed'); return }
            } catch { /* keep polling */ }
            // Kashier's webhook usually lands within a few seconds; poll up to ~1 min.
            if (tries < 20) setTimeout(tick, 3000)
        }
        tick()
        return () => { stop = true }
    }, [orderId])

    const t = (ar: string, en: string) => (isAr ? ar : en)

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} className='min-h-[70vh] flex items-center justify-center px-4'>
            <div className='w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-8 text-center'>
                {status === 'pending' && (
                    <>
                        <div className='mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#1E7D67]/20 border-t-[#1E7D67]' />
                        <h1 className='text-xl font-extrabold text-[#0B2923]'>{t('جارٍ تأكيد الدفع…', 'Confirming your payment…')}</h1>
                        <p className='mt-2 text-sm text-gray-500'>{t('لحظات ويتم تجهيز أكاديميتك.', 'One moment while we set up your academy.')}</p>
                    </>
                )}
                {status === 'paid' && (
                    <>
                        <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl'>✅</div>
                        <h1 className='text-xl font-extrabold text-[#0B2923]'>{t('تم الدفع بنجاح!', 'Payment successful!')}</h1>
                        <p className='mt-2 text-sm text-gray-500'>
                            {t('يتم الآن إنشاء أكاديميتك، وستكون جاهزة خلال دقائق.', 'Your academy is being created and will be ready in a few minutes.')}
                        </p>
                        <LocaleLink href='/account' className='mt-6 inline-block rounded-full bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-3 font-bold text-[#00FFB2]'>
                            {t('الذهاب إلى منصاتي', 'Go to my platforms')}
                        </LocaleLink>
                    </>
                )}
                {(status === 'failed' || status === 'error') && (
                    <>
                        <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl'>⚠️</div>
                        <h1 className='text-xl font-extrabold text-[#0B2923]'>{t('لم يكتمل الدفع', 'Payment not completed')}</h1>
                        <p className='mt-2 text-sm text-gray-500'>
                            {t('لم يتم خصم أي مبلغ. يمكنك المحاولة مرة أخرى.', 'You were not charged. You can try again.')}
                        </p>
                        <LocaleLink href='/build-product' className='mt-6 inline-block rounded-full border border-[#1E7D67] px-6 py-3 font-bold text-[#1E7D67] hover:bg-[#1E7D67]/5'>
                            {t('المحاولة مرة أخرى', 'Try again')}
                        </LocaleLink>
                    </>
                )}
            </div>
        </div>
    )
}
