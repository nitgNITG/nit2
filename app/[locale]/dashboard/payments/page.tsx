'use client'

import React from 'react'
import { useLocale } from 'next-intl'
import PaymentsHistory from '../../components/PaymentsHistory'

// Admin payment history — every payment across all academies (the API returns all
// rows for admins, with the owner attached).
export default function DashboardPaymentsPage() {
    const isAr = useLocale() === 'ar'
    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <div>
                <h1 className='text-2xl font-extrabold text-[#0B2923]'>{isAr ? 'المدفوعات' : 'Payments'}</h1>
                <p className='mt-1 text-sm text-gray-500'>
                    {isAr
                        ? 'كل عمليات الدفع عبر المنصة — إنشاء، تجديد، ترقية، وتحديث البطاقة.'
                        : 'Every payment across the platform — creations, renewals, upgrades and card updates.'}
                </p>
            </div>
            <PaymentsHistory />
        </div>
    )
}
