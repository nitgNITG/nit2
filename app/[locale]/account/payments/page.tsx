'use client'

import React from 'react'
import { useLocale } from 'next-intl'
import LocaleLink from '../../components/LocaleLink'
import PaymentsHistory from '../../components/PaymentsHistory'
import { useMe } from '../../components/useMe'

// The signed-in user's own payment history (the API scopes rows to their account).
export default function AccountPaymentsPage() {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const me = useMe()

    if (me === null) {
        return (
            <div dir={isAr ? 'rtl' : 'ltr'} className='mx-auto max-w-md px-4 py-24 text-center'>
                <p className='text-[#0B2923]'>{tr('لازم تسجّل الدخول الأول.', 'Please sign in first.')}</p>
                <LocaleLink href='/account' className='mt-4 inline-block rounded-full bg-[#0B2923] px-6 py-2.5 font-bold text-[#00FFB2]'>
                    {tr('تسجيل الدخول', 'Sign in')}
                </LocaleLink>
            </div>
        )
    }

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} className='mx-auto max-w-4xl px-4 py-10'>
            <div className='mb-6 flex items-center justify-between gap-4'>
                <h1 className='text-2xl font-extrabold text-[#0B2923]'>{tr('سجل المدفوعات', 'Payment history')}</h1>
                <LocaleLink href='/account' className='text-sm font-bold text-[#1E7D67] hover:underline'>
                    {tr('منصاتي ←', '← My platforms')}
                </LocaleLink>
            </div>
            <PaymentsHistory />
        </div>
    )
}
