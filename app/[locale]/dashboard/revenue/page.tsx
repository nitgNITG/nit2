'use client'

import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocale } from 'next-intl'
import LocalLink from '../../components/LocaleLink'

type Money = { currency: string; total: number; count: number }
type AcademyRow = { slug: string; name: string; currency: string; count: number; total: number; settled: number; outstanding: number }
type PurposeRow = { purpose: string; currency: string; count: number; total: number }
type Summary = {
    student: { byAcademy: AcademyRow[]; totals: (Money & { settled: number; outstanding: number })[] }
    own: { byPurpose: PurposeRow[]; totals: Money[] }
    grandTotals: Money[]
    outstandingTotals: Money[]
}

const fmt = (n: number, ccy: string) => `${n.toLocaleString()} ${ccy}`

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
    const [mode, setMode] = useState<'live' | 'test' | 'all'>('live')
    const [data, setData] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [syncing, setSyncing] = useState(false)
    const [syncMsg, setSyncMsg] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params: Record<string, string> = { mode }
            if (from) params.from = new Date(from).toISOString()
            if (to) params.to = new Date(to + 'T23:59:59').toISOString()
            const { data } = await axios.get('/api/revenue/summary', { params })
            setData(data)
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load revenue')
        } finally {
            setLoading(false)
        }
    }, [from, to, mode])

    useEffect(() => { load() }, [load])

    const syncAcademies = async () => {
        setSyncing(true); setSyncMsg('')
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

    const modeTabs: { key: 'live' | 'test' | 'all'; ar: string; en: string }[] = [
        { key: 'live', ar: 'مباشر', en: 'Live' },
        { key: 'test', ar: 'تجريبي', en: 'Test' },
        { key: 'all', ar: 'الكل', en: 'All' },
    ]

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

            {/* Live / test selector */}
            <div className='flex flex-wrap items-center gap-4'>
                <div className='inline-flex overflow-hidden rounded-lg border border-gray-200'>
                    {modeTabs.map((t) => (
                        <button key={t.key} onClick={() => setMode(t.key)}
                            className={`px-4 py-2 text-sm font-semibold ${mode === t.key ? 'bg-[#0B2923] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                            {tr(t.ar, t.en)}
                        </button>
                    ))}
                </div>
                {mode === 'test' && (
                    <span className='rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700'>
                        {tr('تعرض مدفوعات تجريبية (Sandbox) — ليست إيرادات حقيقية', 'Showing TEST (sandbox) payments — not real revenue')}
                    </span>
                )}
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

            {/* Per academy */}
            <div className='rounded-xl border border-gray-200 bg-white shadow-sm'>
                <div className='border-b border-gray-100 px-5 py-4'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('حسب الأكاديمية (مدفوعات الطلاب)', 'By academy (student payments)')}</h2>
                    <p className='mt-0.5 text-xs text-gray-400'>{tr('افتح تفاصيل الأكاديمية للاطّلاع على العمليات وتسجيل الدفعات للمالك.', 'Open an academy’s details to see its transactions and record payouts to the owner.')}</p>
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
                            {(data?.student.byAcademy ?? []).map((r) => (
                                <tr key={r.slug + r.currency} className='hover:bg-gray-50'>
                                    <td className='px-4 py-3'>
                                        <span className='font-semibold text-[#0B2923]'>{r.name}</span>
                                        <span className='ms-2 text-xs text-gray-400'>{r.slug}</span>
                                    </td>
                                    <td className='px-4 py-3 text-gray-500'>{r.currency}</td>
                                    <td className='px-4 py-3 text-end text-gray-500'>{r.count}</td>
                                    <td className='px-4 py-3 text-end font-semibold text-[#1E7D67]'>{fmt(r.total, r.currency)}</td>
                                    <td className='px-4 py-3 text-end text-gray-500'>{fmt(r.settled, r.currency)}</td>
                                    <td className={`px-4 py-3 text-end font-bold ${r.outstanding > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{fmt(r.outstanding, r.currency)}</td>
                                    <td className='px-4 py-3 text-end'>
                                        <LocalLink href={`/dashboard/revenue/${r.slug}`}
                                            className='rounded-md border border-[#268F79] px-3 py-1.5 text-xs font-semibold text-[#268F79] hover:bg-[#268F79]/5'>
                                            {tr('تفاصيل', 'Details')} →
                                        </LocalLink>
                                    </td>
                                </tr>
                            ))}
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
