'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import axios from 'axios'

type Row = {
    orderId: string
    licenseKey: string
    purpose: string
    amount: number
    currency: string
    status: string
    academySlug: string | null
    academyName: string | null
    providerRef: string | null
    failureReason: string | null
    kind: string
    createdAt: string
    paidAt: string | null
    owner?: { name: string | null; email: string } | null
}

const STATUS_CLS: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-700',
    pending: 'bg-amber-100 text-amber-800',
    expired: 'bg-gray-100 text-gray-500',
}
const PURPOSE_LABEL: Record<string, [string, string]> = {
    new_academy: ['أكاديمية جديدة', 'New academy'],
    renew: ['تجديد', 'Renewal'],
    upgrade: ['ترقية', 'Upgrade'],
    update_card: ['تحديث بطاقة', 'Card update'],
}

// Payment history table — shared by the admin dashboard and the user's account.
// The API scopes rows by role (admin = all, client = own) and only sends the
// `owner` field to admins, so `showOwner` follows what actually comes back.
export default function PaymentsHistory() {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)

    const [rows, setRows] = useState<Row[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState('')
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const limit = 20

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/payments', { params: { page, status, purpose, limit } })
            setRows(data.payments ?? [])
            setTotal(data.total ?? 0)
            setIsAdmin(!!data.isAdmin)
        } catch {
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [page, status, purpose])

    useEffect(() => { load() }, [load])
    // Reset to page 1 whenever a filter changes.
    useEffect(() => { setPage(1) }, [status, purpose])

    const pages = Math.max(1, Math.ceil(total / limit))
    const fmt = (d: string | null) =>
        d ? new Date(d).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
    const statusLabel = (s: string) =>
        ({ paid: tr('مدفوع', 'Paid'), failed: tr('فشل', 'Failed'), pending: tr('معلّق', 'Pending'), expired: tr('منتهي', 'Expired') } as Record<string, string>)[s] || s

    const select = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700'

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} className='space-y-3'>
            {/* Filters */}
            <div className='flex flex-wrap items-center gap-2'>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
                    <option value=''>{tr('كل الحالات', 'All statuses')}</option>
                    <option value='paid'>{tr('مدفوع', 'Paid')}</option>
                    <option value='pending'>{tr('معلّق', 'Pending')}</option>
                    <option value='failed'>{tr('فشل', 'Failed')}</option>
                    <option value='expired'>{tr('منتهي', 'Expired')}</option>
                </select>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={select}>
                    <option value=''>{tr('كل الأنواع', 'All types')}</option>
                    <option value='new_academy'>{tr('أكاديمية جديدة', 'New academy')}</option>
                    <option value='renew'>{tr('تجديد', 'Renewal')}</option>
                    <option value='upgrade'>{tr('ترقية', 'Upgrade')}</option>
                    <option value='update_card'>{tr('تحديث بطاقة', 'Card update')}</option>
                </select>
                <span className='ms-auto text-xs text-gray-500'>{tr(`الإجمالي: ${total}`, `${total} total`)}</span>
            </div>

            <div className='overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-50 text-left text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 font-semibold'>{tr('التاريخ', 'Date')}</th>
                            <th className='px-4 py-3 font-semibold'>{tr('الأكاديمية', 'Academy')}</th>
                            {isAdmin && <th className='px-4 py-3 font-semibold'>{tr('المالك', 'Owner')}</th>}
                            <th className='px-4 py-3 font-semibold'>{tr('النوع', 'Type')}</th>
                            <th className='px-4 py-3 font-semibold'>{tr('المبلغ', 'Amount')}</th>
                            <th className='px-4 py-3 font-semibold'>{tr('الحالة', 'Status')}</th>
                            <th className='px-4 py-3 font-semibold'>{tr('المرجع', 'Ref')}</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                        {loading ? (
                            <tr><td colSpan={isAdmin ? 7 : 6} className='px-4 py-10 text-center text-gray-400'>{tr('جارٍ التحميل…', 'Loading…')}</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={isAdmin ? 7 : 6} className='px-4 py-10 text-center text-gray-400'>{tr('لا توجد مدفوعات.', 'No payments yet.')}</td></tr>
                        ) : rows.map((p) => (
                            <tr key={p.orderId} className='hover:bg-gray-50'>
                                <td className='px-4 py-3 whitespace-nowrap text-gray-600'>{fmt(p.paidAt || p.createdAt)}</td>
                                <td className='px-4 py-3'>
                                    <div className='font-semibold text-gray-900'>{p.academyName || p.academySlug || '—'}</div>
                                    <div className='text-xs text-gray-400 font-mono'>{p.licenseKey}</div>
                                </td>
                                {isAdmin && (
                                    <td className='px-4 py-3'>
                                        <div className='text-gray-800'>{p.owner?.name || '—'}</div>
                                        <div className='text-xs text-gray-400 font-mono truncate max-w-[180px]'>{p.owner?.email}</div>
                                    </td>
                                )}
                                <td className='px-4 py-3'>
                                    <span className='text-gray-700'>{(PURPOSE_LABEL[p.purpose]?.[isAr ? 0 : 1]) || p.purpose}</span>
                                    <span className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.kind === 'auto-renew' ? 'bg-[#1E7D67]/10 text-[#1E7D67]' : 'bg-gray-100 text-gray-500'}`}>
                                        {p.kind === 'auto-renew' ? tr('تلقائي', 'auto') : tr('يدوي', 'manual')}
                                    </span>
                                </td>
                                <td className='px-4 py-3 whitespace-nowrap font-bold text-gray-900' dir='ltr'>{p.amount} {p.currency}</td>
                                <td className='px-4 py-3'>
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[p.status] || 'bg-gray-100 text-gray-500'}`} title={p.failureReason || ''}>
                                        {statusLabel(p.status)}
                                    </span>
                                </td>
                                <td className='px-4 py-3 font-mono text-xs text-gray-400' dir='ltr'>{p.providerRef || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className='flex items-center justify-center gap-2 text-sm'>
                    <button onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1}
                        className='rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40'>
                        {tr('السابق', 'Prev')}
                    </button>
                    <span className='text-gray-500'>{tr(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
                    <button onClick={() => setPage((n) => Math.min(pages, n + 1))} disabled={page >= pages}
                        className='rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40'>
                        {tr('التالي', 'Next')}
                    </button>
                </div>
            )}
        </div>
    )
}
