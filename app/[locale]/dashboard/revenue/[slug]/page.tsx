'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import LocalLink from '../../../components/LocaleLink'

type Txn = {
    id: string; orderId: string; amount: number; currency: string; provider: string
    kind: string; courseId: number | null; userRef: string | null; paidAt: string; mode: string
    settled: boolean; settledAt: string | null; settlementRef: string | null; settlementId: string | null
}
type Settlement = {
    id: string; academySlug: string; currency: string; amount: number; txnCount: number
    method: string; reference: string | null; note: string | null; createdAt: string
}

const fmt = (n: number, ccy: string) => `${n.toLocaleString()} ${ccy}`

export default function AcademyRevenueDetailPage() {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const params = useParams()
    const slug = String((params as any)?.slug ?? '')

    const [mode, setMode] = useState<'live' | 'test' | 'all'>('live')
    const [name, setName] = useState(slug)
    const [txns, setTxns] = useState<Txn[]>([])
    const [settlements, setSettlements] = useState<Settlement[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Payout form.
    const [method, setMethod] = useState('bank')
    const [reference, setReference] = useState('')
    const [note, setNote] = useState('')

    const load = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const [tx, st] = await Promise.all([
                axios.get('/api/revenue/transactions', { params: { academySlug: slug, mode, settled: 'all', limit: 500 } }),
                axios.get('/api/revenue/settlements', { params: { academySlug: slug } }),
            ])
            setName(tx.data.academyName ?? slug)
            setTxns(tx.data.transactions ?? [])
            setSettlements(st.data.settlements ?? [])
            setSelected(new Set())
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to load')
        } finally {
            setLoading(false)
        }
    }, [slug, mode])

    useEffect(() => { load() }, [load])

    // Totals per currency from the loaded transactions.
    const totals = useMemo(() => {
        const m = new Map<string, { currency: string; earned: number; settled: number; outstanding: number; count: number }>()
        for (const t of txns) {
            const e = m.get(t.currency) ?? { currency: t.currency, earned: 0, settled: 0, outstanding: 0, count: 0 }
            e.earned += t.amount; e.count += 1
            if (t.settled) e.settled += t.amount; else e.outstanding += t.amount
            m.set(t.currency, e)
        }
        return Array.from(m.values()).sort((a, b) => b.earned - a.earned)
    }, [txns])

    const outstandingByCcy = totals.filter((t) => t.outstanding > 0)

    const toggle = (orderId: string) => setSelected((s) => {
        const n = new Set(s); n.has(orderId) ? n.delete(orderId) : n.add(orderId); return n
    })

    const settle = async (orderIds?: string[]) => {
        const scope = orderIds?.length
            ? tr(`${orderIds.length} عملية محددة`, `${orderIds.length} selected`)
            : tr('كل المستحق', 'all outstanding')
        if (!window.confirm(tr(`تسجيل دفعة للمالك (${scope})؟`, `Record a payout to the owner (${scope})?`))) return
        setBusy(true); setError('')
        try {
            await axios.post('/api/revenue/settle', {
                academySlug: slug,
                mode: 'live',
                method,
                reference: reference || undefined,
                note: note || undefined,
                orderIds: orderIds?.length ? orderIds : undefined,
            })
            setReference(''); setNote('')
            await load()
        } catch (e: any) {
            setError(e?.response?.data?.error || tr('فشلت التسوية', 'Settle failed'))
        } finally {
            setBusy(false)
        }
    }

    const voidSettlement = async (s: Settlement) => {
        if (!window.confirm(tr(`إلغاء الدفعة ${fmt(s.amount, s.currency)}؟ ستعود العمليات كمستحقة.`, `Void the ${fmt(s.amount, s.currency)} payout? Its transactions return to outstanding.`))) return
        setBusy(true); setError('')
        try {
            await axios.delete('/api/revenue/settlements', { params: { id: s.id } })
            await load()
        } catch (e: any) {
            setError(e?.response?.data?.error || tr('فشل الإلغاء', 'Void failed'))
        } finally {
            setBusy(false)
        }
    }

    const modeTabs: { key: 'live' | 'test' | 'all'; ar: string; en: string }[] = [
        { key: 'live', ar: 'مباشر', en: 'Live' },
        { key: 'test', ar: 'تجريبي', en: 'Test' },
        { key: 'all', ar: 'الكل', en: 'All' },
    ]
    const selectedIds = Array.from(selected)

    return (
        <div className='dashboard-container space-y-6 py-5 lg:py-10'>
            <div>
                <LocalLink href='/dashboard/revenue' className='text-sm text-[#268F79] hover:underline'>← {tr('كل الإيرادات', 'All revenue')}</LocalLink>
                <h1 className='mt-1 text-2xl font-extrabold text-[#0B2923]'>{name}</h1>
                <p className='text-sm text-gray-400'>{slug}</p>
            </div>

            {/* Mode selector */}
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
                        {tr('مدفوعات تجريبية — لا تُسوّى', 'Test payments — not settled')}
                    </span>
                )}
            </div>

            {error && <div className='rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>}

            {/* Totals */}
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                {totals.length === 0 ? (
                    <div className='text-sm text-gray-400'>{loading ? tr('جارٍ التحميل…', 'Loading…') : tr('لا توجد عمليات.', 'No transactions.')}</div>
                ) : totals.map((t) => (
                    <div key={t.currency} className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
                        <div className='text-xs font-semibold uppercase tracking-wide text-gray-400'>{t.currency} · {t.count} {tr('عملية', 'payments')}</div>
                        <div className='mt-2 text-2xl font-extrabold text-[#1E7D67]'>{fmt(t.earned, t.currency)}</div>
                        <div className='mt-1 flex justify-between text-xs'>
                            <span className='text-gray-500'>{tr('مُسوّى', 'Settled')}: {fmt(t.settled, t.currency)}</span>
                            <span className={t.outstanding > 0 ? 'font-bold text-amber-600' : 'text-gray-400'}>{tr('مستحق', 'Outstanding')}: {fmt(t.outstanding, t.currency)}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Payout controls (live only) */}
            {mode !== 'test' && outstandingByCcy.length > 0 && (
                <div className='rounded-xl border border-amber-200 bg-amber-50/50 p-5'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('تسجيل دفعة للمالك', 'Record a payout to the owner')}</h2>
                    <p className='mt-0.5 text-xs text-gray-500'>{tr('يسجّل ما دفعته للمالك (لا يحرّك أموالاً فعلياً). ينشئ سجل دفعة لكل عملة.', 'Records what you paid the owner (no real money moves). Creates one payout record per currency.')}</p>
                    <div className='mt-3 flex flex-wrap items-end gap-3'>
                        <label className='text-sm'>
                            <span className='mb-1 block font-semibold text-gray-600'>{tr('الطريقة', 'Method')}</span>
                            <select value={method} onChange={(e) => setMethod(e.target.value)} className='rounded-lg border px-3 py-2'>
                                <option value='bank'>{tr('تحويل بنكي', 'Bank transfer')}</option>
                                <option value='instapay'>InstaPay</option>
                                <option value='wallet'>{tr('محفظة', 'Wallet')}</option>
                                <option value='cash'>{tr('نقدي', 'Cash')}</option>
                                <option value='other'>{tr('أخرى', 'Other')}</option>
                            </select>
                        </label>
                        <label className='text-sm'>
                            <span className='mb-1 block font-semibold text-gray-600'>{tr('المرجع', 'Reference')}</span>
                            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={tr('رقم التحويل…', 'Transfer id…')} className='rounded-lg border px-3 py-2' />
                        </label>
                        <label className='text-sm flex-1 min-w-40'>
                            <span className='mb-1 block font-semibold text-gray-600'>{tr('ملاحظة', 'Note')}</span>
                            <input value={note} onChange={(e) => setNote(e.target.value)} className='w-full rounded-lg border px-3 py-2' />
                        </label>
                    </div>
                    <div className='mt-3 flex flex-wrap gap-3'>
                        <button onClick={() => settle()} disabled={busy}
                            className='rounded-md bg-amber-500 px-5 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60'>
                            {busy ? tr('جارٍ…', '…') : tr(`تسوية كل المستحق (${outstandingByCcy.map((t) => fmt(t.outstanding, t.currency)).join(' + ')})`, `Settle all outstanding (${outstandingByCcy.map((t) => fmt(t.outstanding, t.currency)).join(' + ')})`)}
                        </button>
                        {selectedIds.length > 0 && (
                            <button onClick={() => settle(selectedIds)} disabled={busy}
                                className='rounded-md border border-amber-500 px-5 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60'>
                                {tr(`تسوية المحدد (${selectedIds.length})`, `Settle selected (${selectedIds.length})`)}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Transactions */}
            <div className='rounded-xl border border-gray-200 bg-white shadow-sm'>
                <div className='border-b border-gray-100 px-5 py-4'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('العمليات', 'Transactions')}</h2>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-gray-50 text-xs uppercase text-gray-400'>
                            <tr>
                                <th className='px-3 py-3'></th>
                                <th className='px-3 py-3 text-start'>{tr('رقم الطلب', 'Order')}</th>
                                <th className='px-3 py-3 text-start'>{tr('النوع', 'Kind')}</th>
                                <th className='px-3 py-3 text-start'>{tr('التاريخ', 'Date')}</th>
                                <th className='px-3 py-3 text-start'>{tr('الوضع', 'Mode')}</th>
                                <th className='px-3 py-3 text-end'>{tr('المبلغ', 'Amount')}</th>
                                <th className='px-3 py-3 text-start'>{tr('الحالة', 'Status')}</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-100'>
                            {txns.map((t) => (
                                <tr key={t.id} className='hover:bg-gray-50'>
                                    <td className='px-3 py-2'>
                                        {!t.settled && t.mode === 'live' && (
                                            <input type='checkbox' checked={selected.has(t.orderId)} onChange={() => toggle(t.orderId)} />
                                        )}
                                    </td>
                                    <td className='px-3 py-2 font-mono text-[11px] text-gray-600'>{t.orderId}</td>
                                    <td className='px-3 py-2 text-gray-500'>{t.kind === 'subscription' ? tr('اشتراك', 'Subscription') : tr('دورة', 'Course')}{t.courseId ? ` #${t.courseId}` : ''}</td>
                                    <td className='px-3 py-2 text-gray-500'>{new Date(t.paidAt).toLocaleDateString()}</td>
                                    <td className='px-3 py-2'>
                                        {t.mode === 'test'
                                            ? <span className='rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700'>TEST</span>
                                            : <span className='rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700'>LIVE</span>}
                                    </td>
                                    <td className='px-3 py-2 text-end font-semibold'>{fmt(t.amount, t.currency)}</td>
                                    <td className='px-3 py-2'>
                                        {t.settled
                                            ? <span className='rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700'>{tr('مُسوّى', 'Settled')}{t.settlementRef ? ` · ${t.settlementRef}` : ''}</span>
                                            : <span className='rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700'>{tr('مستحق', 'Outstanding')}</span>}
                                    </td>
                                </tr>
                            ))}
                            {!loading && txns.length === 0 && (
                                <tr><td colSpan={7} className='px-5 py-8 text-center text-gray-400'>{tr('لا توجد عمليات.', 'No transactions.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payout history */}
            <div className='rounded-xl border border-gray-200 bg-white shadow-sm'>
                <div className='border-b border-gray-100 px-5 py-4'>
                    <h2 className='font-bold text-[#0B2923]'>{tr('سجل الدفعات للمالك', 'Payout history')}</h2>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                        <thead className='bg-gray-50 text-xs uppercase text-gray-400'>
                            <tr>
                                <th className='px-4 py-3 text-start'>{tr('التاريخ', 'Date')}</th>
                                <th className='px-4 py-3 text-end'>{tr('المبلغ', 'Amount')}</th>
                                <th className='px-4 py-3 text-start'>{tr('الطريقة', 'Method')}</th>
                                <th className='px-4 py-3 text-start'>{tr('المرجع', 'Reference')}</th>
                                <th className='px-4 py-3 text-end'>{tr('العمليات', 'Txns')}</th>
                                <th className='px-4 py-3 text-end'></th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-100'>
                            {settlements.map((s) => (
                                <tr key={s.id}>
                                    <td className='px-4 py-2 text-gray-600'>{new Date(s.createdAt).toLocaleString()}</td>
                                    <td className='px-4 py-2 text-end font-bold text-[#0B2923]'>{fmt(s.amount, s.currency)}</td>
                                    <td className='px-4 py-2 text-gray-500'>{s.method}</td>
                                    <td className='px-4 py-2 text-gray-500'>{s.reference || '—'}{s.note ? ` · ${s.note}` : ''}</td>
                                    <td className='px-4 py-2 text-end text-gray-500'>{s.txnCount}</td>
                                    <td className='px-4 py-2 text-end'>
                                        <button onClick={() => voidSettlement(s)} disabled={busy}
                                            className='rounded border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50'>
                                            {tr('إلغاء', 'Void')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && settlements.length === 0 && (
                                <tr><td colSpan={6} className='px-5 py-8 text-center text-gray-400'>{tr('لا توجد دفعات بعد.', 'No payouts yet.')}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
