'use client'

import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocale } from 'next-intl'

type Money = { currency: string; total: number; count: number }
type AcademyRow = { slug: string; name: string; currency: string; count: number; total: number; settled: number; outstanding: number }
type PurposeRow = { purpose: string; currency: string; count: number; total: number }
type Summary = {
    range: { from: string | null; to: string | null }
    student: { byAcademy: AcademyRow[]; totals: (Money & { settled: number; outstanding: number })[] }
    own: { byPurpose: PurposeRow[]; totals: Money[] }
    grandTotals: Money[]
    outstandingTotals: Money[]
}
type Txn = {
    id: string; orderId: string; amount: number; currency: string; provider: string
    kind: string; courseId: number | null; userRef: string | null; paidAt: string
    settled: boolean; settledAt: string | null; settlementRef: string | null
}

const fmt = (n: number, ccy: string) => `${n.toLocaleString()} ${ccy}`
const rowKey = (slug: string, ccy: string) => `${slug}|${ccy}`

const PURPOSE_LABEL: Record<string, { ar: string; en: string }> = {
    new_academy: { ar: 'أكاديمية جديدة', en: 'New academy' },
    upgrade: { ar: 'ترقية', en: 'Upgrade' },
    renew: { ar: 'تجديد', en: 'Renewal' },
    update_card: { ar: 'تحديث البطاقة', en: 'Card update' },
}

export default function RevenueDashboardPage() {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)

    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [data, setData] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncMsg, setSyncMsg] = useState('')
    // Per-academy-row drill-down + settlement.
    const [expanded, setExpanded] = useState<string | null>(null)
    const [txns, setTxns] = useState<Record<string, Txn[]>>({})
    const [busyKey, setBusyKey] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params: Record<string, string> = {}
            if (from) params.from = new Date(from).toISOString()
            if (to) params.to = new Date(to + 'T23:59:59').toISOString()
            const { data } = await axios.get('/api/revenue/summary', { params })
            setData(data)
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load revenue')
        } finally {
            setLoading(false)
        }
    }, [from, to])

    useEffect(() => { load() }, [load])

    const syncAcademies = async () => {
        setSyncing(true)
        setSyncMsg('')
        try {
            const { data } = await axios.post('/api/academies/apply-integrations-all')
            const skipped = data.skipped?.length ? ` · ${data.skipped.length} ${tr('تخطّي', 'skipped')}` : ''
            setSyncMsg(`${tr('تم الإرسال إلى', 'Pushed to')} ${data.applied}/${data.total} ${tr('أكاديمية', 'academies')}${skipped}`)
        } catch (e: any) {
            setSyncMsg(e?.response?.data?.error || tr('فشل المزامنة', 'Sync failed'))
        } finally {
            setSyncing(false)
        }
    }

    const loadTxns = useCallback(async (slug: string, currency: string) => {
        const key = rowKey(slug, currency)
        try {
            const { data } = await axios.get('/api/revenue/transactions', { params: { academySlug: slug, currency, settled: 'all', limit: 500 } })
            setTxns((t) => ({ ...t, [key]: data.transactions ?? [] }))
        } catch {
            setTxns((t) => ({ ...t, [key]: [] }))
        }
    }, [])

    const toggleExpand = (slug: string, currency: string) => {
        const key = rowKey(slug, currency)
        if (expanded === key) { setExpanded(null); return }
        setExpanded(key)
        if (!txns[key]) loadTxns(slug, currency)
    }

    // Settle (or unsettle) all outstanding for one academy+currency.
    const settleRow = async (row: AcademyRow) => {
        const amount = fmt(row.outstanding, row.currency)
        const reference = window.prompt(
            tr(`تسوية ${amount} لـ ${row.name}؟ أدخل مرجع الدفع (اختياري):`, `Settle ${amount} for ${row.name}? Enter a payout reference (optional):`),
            '',
        )
        if (reference === null) return // cancelled
        const key = rowKey(row.slug, row.currency)
        setBusyKey(key)
        try {
            await axios.post('/api/revenue/settle', { academySlug: row.slug, currency: row.currency, reference: reference || undefined })
            await load()
            if (expanded === key) await loadTxns(row.slug, row.currency)
        } catch (e: any) {
            setError(e?.response?.data?.error || tr('فشلت التسوية', 'Settle failed'))
        } finally {
            setBusyKey('')
        }
    }

    // Settle / unsettle a single transaction.
    const settleTxn = async (slug: string, currency: string, t: Txn) => {
        const key = rowKey(slug, currency)
        setBusyKey(key + t.orderId)
        try {
            await axios.post('/api/revenue/settle', {
                action: t.settled ? 'unsettle' : 'settle',
                academySlug: slug, currency, orderIds: [t.orderId],
            })
            await Promise.all([load(), loadTxns(slug, currency)])
        } catch (e: any) {
            setError(e?.response?.data?.error || tr('فشلت العملية', 'Action failed'))
        } finally {
            setBusyKey('')
        }
    }

    const Card = ({ title, rows, tone }: { title: string; rows: Money[]; tone: string }) => (
        <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
            <div className='text-xs font-semibold uppercase tracking-wide text-gray-400'>{title}</div>
            {rows.length === 0 ? (
                <div className='mt-2 text-2xl font-extrabold text-gray-300'>—</div>
            ) : (
                <div className='mt-2 space-y-1'>
                    {rows.map((r) => (
                        <div key={r.currency} className='flex items-baseline justify-between gap-3'>
                            <span className={`text-2xl font-extrabold ${tone}`}>{fmt(r.total, r.currency)}</span>
                            {r.count > 0 && <span className='text-xs text-gray-400'>{r.count} {tr('عملية', 'payments')}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    return (
        <div className='dashboard-container space-y-6 py-5 lg:py-10'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h1 className='text-2xl font-extrabold text-[#0B2923]'>{tr('الإيرادات', 'Revenue')}</h1>
                    <p className='mt-1 text-sm text-gray-500'>
                        {tr(
                            'إيرادات كل أكاديمية (مدفوعات الطلاب) وما تم تسويته للمالك وما لم يُسوَّ بعد.',
                            'Per-academy revenue (student payments), what’s been settled to the owner, and what’s still outstanding.',
                        )}
                    </p>
                </div>
                <div className='text-end'>
                    <button onClick={syncAcademies} disabled={syncing}
                        className='rounded-md border border-[#268F79] px-4 py-2 text-sm font-semibold text-[#268F79] hover:bg-[#268F79]/5 disabled:opacity-60'
                        title={tr('إرسال إعدادات الإيرادات لكل الأكاديميات', 'Push revenue config to all academies')}>
                        {syncing ? tr('جارٍ المزامنة…', 'Syncing…') : tr('🔄 مزامنة الأكاديميات', '🔄 Sync academies')}
                    </button>
                    {syncMsg && <p className='mt-1 text-xs text-gray-500'>{syncMsg}</p>}
                </div>
            </div>

            {/* Date range */}
            <div className='flex flex-wrap items-end gap-3'>
                <label className='text-sm'>
                    <span className='mb-1 block font-semibold text-gray-600'>{tr('من', 'From')}</span>
                    <input type='date' value={from} onChange={(e) => setFrom(e.target.value)} className='rounded-lg border px-3 py-2' />
                </label>
                <label className='text-sm'>
                    <span className='mb-1 block font-semibold text-gray-600'>{tr('إلى', 'To')}</span>
                    <input type='date' value={to} onChange={(e) => setTo(e.target.value)} className='rounded-lg border px-3 py-2' />
                </label>
                <button onClick={load} disabled={loading}
                    className='rounded-md bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-2 font-bold text-[#00FFB2] disabled:opacity-60'>
                    {loading ? tr('جارٍ…', 'Loading…') : tr('تحديث', 'Refresh')}
                </button>
                {(from || to) && (
                    <button onClick={() => { setFrom(''); setTo('') }}
                        className='rounded-md border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50'>
                        {tr('كل الفترات', 'All time')}
                    </button>
                )}
            </div>

            {error && <div className='rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>}

            {/* Totals */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <Card title={tr('إجمالي الإيرادات', 'Grand total')} rows={data?.grandTotals ?? []} tone='text-[#0B2923]' />
                <Card title={tr('إيرادات الأكاديميات (الطلاب)', 'Academies (students)')} rows={data?.student.totals ?? []} tone='text-[#1E7D67]' />
                <Card title={tr('مستحق للملّاك (غير مُسوّى)', 'Outstanding to owners')} rows={data?.outstandingTotals ?? []} tone='text-amber-600' />
                <Card title={tr('إيرادات المنصة (الباقات)', 'Platform (licences)')} rows={data?.own.totals ?? []} tone='text-[#268F79]' />
            </div>

            {/* Per academy + settlement */}
            <div className='rounded-xl border border-gray-200 bg-white shadow-sm'>
                <div className='border-b border-gray-100 px-5 py-4'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('حسب الأكاديمية (مدفوعات الطلاب)', 'By academy (student payments)')}</h2>
                    <p className='mt-0.5 text-xs text-gray-400'>{tr('اضغط على صف لعرض العمليات. «تسوية» تُعلّم المبلغ المستحق كمدفوع للمالك.', 'Click a row to see its transactions. “Settle” marks the outstanding amount as paid to the owner.')}</p>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-gray-50 text-xs uppercase text-gray-400'>
                            <tr>
                                <th className='px-4 py-3 text-start'>{tr('الأكاديمية', 'Academy')}</th>
                                <th className='px-4 py-3 text-start'>{tr('العملة', 'Currency')}</th>
                                <th className='px-4 py-3 text-end'>{tr('العمليات', 'Payments')}</th>
                                <th className='px-4 py-3 text-end'>{tr('محصّل', 'Earned')}</th>
                                <th className='px-4 py-3 text-end'>{tr('مُسوّى', 'Settled')}</th>
                                <th className='px-4 py-3 text-end'>{tr('مستحق', 'Outstanding')}</th>
                                <th className='px-4 py-3 text-end'></th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-100'>
                            {(data?.student.byAcademy ?? []).map((r) => {
                                const key = rowKey(r.slug, r.currency)
                                const isOpen = expanded === key
                                const list = txns[key]
                                return (
                                    <React.Fragment key={key}>
                                        <tr className='cursor-pointer hover:bg-gray-50' onClick={() => toggleExpand(r.slug, r.currency)}>
                                            <td className='px-4 py-3'>
                                                <span className='me-1 text-gray-400'>{isOpen ? '▾' : '▸'}</span>
                                                <span className='font-semibold text-[#0B2923]'>{r.name}</span>
                                                <span className='ms-2 text-xs text-gray-400'>{r.slug}</span>
                                            </td>
                                            <td className='px-4 py-3 text-gray-500'>{r.currency}</td>
                                            <td className='px-4 py-3 text-end text-gray-500'>{r.count}</td>
                                            <td className='px-4 py-3 text-end font-semibold text-[#1E7D67]'>{fmt(r.total, r.currency)}</td>
                                            <td className='px-4 py-3 text-end text-gray-500'>{fmt(r.settled, r.currency)}</td>
                                            <td className={`px-4 py-3 text-end font-bold ${r.outstanding > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{fmt(r.outstanding, r.currency)}</td>
                                            <td className='px-4 py-3 text-end'>
                                                {r.outstanding > 0 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); settleRow(r) }}
                                                        disabled={busyKey === key}
                                                        className='rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60'>
                                                        {busyKey === key ? tr('جارٍ…', '…') : tr('تسوية', 'Settle')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className='bg-gray-50/60'>
                                                <td colSpan={7} className='px-4 py-3'>
                                                    {!list ? (
                                                        <div className='py-3 text-center text-xs text-gray-400'>{tr('جارٍ التحميل…', 'Loading…')}</div>
                                                    ) : list.length === 0 ? (
                                                        <div className='py-3 text-center text-xs text-gray-400'>{tr('لا توجد عمليات.', 'No transactions.')}</div>
                                                    ) : (
                                                        <table className='w-full text-xs'>
                                                            <thead className='text-gray-400'>
                                                                <tr>
                                                                    <th className='px-2 py-1 text-start'>{tr('رقم الطلب', 'Order')}</th>
                                                                    <th className='px-2 py-1 text-start'>{tr('النوع', 'Kind')}</th>
                                                                    <th className='px-2 py-1 text-start'>{tr('التاريخ', 'Date')}</th>
                                                                    <th className='px-2 py-1 text-end'>{tr('المبلغ', 'Amount')}</th>
                                                                    <th className='px-2 py-1 text-start'>{tr('الحالة', 'Status')}</th>
                                                                    <th className='px-2 py-1 text-end'></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {list.map((t) => (
                                                                    <tr key={t.id} className='border-t border-gray-100'>
                                                                        <td className='px-2 py-1.5 font-mono text-[11px] text-gray-600'>{t.orderId}</td>
                                                                        <td className='px-2 py-1.5 text-gray-500'>{t.kind === 'subscription' ? tr('اشتراك', 'Subscription') : tr('دورة', 'Course')}{t.courseId ? ` #${t.courseId}` : ''}</td>
                                                                        <td className='px-2 py-1.5 text-gray-500'>{new Date(t.paidAt).toLocaleDateString()}</td>
                                                                        <td className='px-2 py-1.5 text-end font-semibold'>{fmt(t.amount, t.currency)}</td>
                                                                        <td className='px-2 py-1.5'>
                                                                            {t.settled ? (
                                                                                <span className='rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700'>
                                                                                    {tr('مُسوّى', 'Settled')}{t.settlementRef ? ` · ${t.settlementRef}` : ''}
                                                                                </span>
                                                                            ) : (
                                                                                <span className='rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700'>{tr('مستحق', 'Outstanding')}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className='px-2 py-1.5 text-end'>
                                                                            <button
                                                                                onClick={() => settleTxn(r.slug, r.currency, t)}
                                                                                disabled={busyKey === key + t.orderId}
                                                                                className='rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-white disabled:opacity-50'>
                                                                                {t.settled ? tr('إلغاء التسوية', 'Unsettle') : tr('تسوية', 'Settle')}
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                            {!loading && (data?.student.byAcademy.length ?? 0) === 0 && (
                                <tr><td colSpan={7} className='px-5 py-8 text-center text-gray-400'>{tr('لا توجد مدفوعات طلاب بعد.', 'No student payments yet.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Platform own */}
            <div className='rounded-xl border border-gray-200 bg-white shadow-sm'>
                <div className='border-b border-gray-100 px-5 py-4'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('إيرادات المنصة (بيع الباقات)', 'Platform revenue (licence sales)')}</h2>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-gray-50 text-xs uppercase text-gray-400'>
                            <tr>
                                <th className='px-5 py-3 text-start'>{tr('النوع', 'Type')}</th>
                                <th className='px-5 py-3 text-start'>{tr('العملة', 'Currency')}</th>
                                <th className='px-5 py-3 text-end'>{tr('عدد العمليات', 'Payments')}</th>
                                <th className='px-5 py-3 text-end'>{tr('الإجمالي', 'Total')}</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-100'>
                            {(data?.own.byPurpose ?? []).map((r) => (
                                <tr key={r.purpose + r.currency}>
                                    <td className='px-5 py-3 font-semibold text-[#0B2923]'>
                                        {PURPOSE_LABEL[r.purpose] ? tr(PURPOSE_LABEL[r.purpose].ar, PURPOSE_LABEL[r.purpose].en) : r.purpose}
                                    </td>
                                    <td className='px-5 py-3 text-gray-500'>{r.currency}</td>
                                    <td className='px-5 py-3 text-end text-gray-500'>{r.count}</td>
                                    <td className='px-5 py-3 text-end font-bold text-[#268F79]'>{fmt(r.total, r.currency)}</td>
                                </tr>
                            ))}
                            {!loading && (data?.own.byPurpose.length ?? 0) === 0 && (
                                <tr><td colSpan={4} className='px-5 py-8 text-center text-gray-400'>{tr('لا توجد مدفوعات بعد.', 'No payments yet.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
