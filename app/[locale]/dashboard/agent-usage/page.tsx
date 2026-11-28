'use client'
// AI usage (FR-C3, US-14): conversations, leads, handoffs, ratings, tokens and cost per day,
// plus cost per model, per UTC day (to match the Anthropic console) and per visitor.
import React, { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import LocaleLink from '../../components/LocaleLink'
import { api, btnGhost, Card, errorText, fmtDate, inputCls, PageHeader } from '../components/agent/ui'

type Day = {
    date: string; conversations: number; leads: number; hotLeads: number; handoffs: number
    thumbsUp: number; thumbsDown: number; tokensIn: number; tokensOut: number; costUsd: number
}
type Breakdown = {
    models: { model: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }[]
    utcDays: { date: string; costUsd: number }[]
    visitors: {
        key: string; kind: 'user' | 'guest' | 'ip' | 'whatsapp'; label: string; detail: string | null; conversations: number; messages: number
        tokensIn: number; tokensOut: number; costUsd: number; lastSeen: string; latestConversationId: string
    }[]
    unattributedUsd: number; totalUsd: number
}
const KIND_LABEL = { user: 'Signed in', guest: 'Guest', ip: 'IP', whatsapp: 'WhatsApp' } as const
const th = 'px-4 py-3'
const td = 'px-4 py-2'

const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
const minusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

export default function AgentUsagePage() {
    const [to, setTo] = useState(cairoToday())
    const [from, setFrom] = useState(minusDays(cairoToday(), 13))
    const [days, setDays] = useState<Day[]>([])
    const [by, setBy] = useState<'visitor' | 'ip'>('visitor')
    const [bd, setBd] = useState<Breakdown | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const [r, b] = await Promise.all([
            api<{ days: Day[] }>(`/api/agent/admin/usage?from=${from}&to=${to}`),
            api<Breakdown>(`/api/agent/admin/usage/breakdown?from=${from}&to=${to}&by=${by}`),
        ])
        if (!r.ok) return setError(errorText(r))
        if (!b.ok) return setError(errorText(b))
        setError('')
        setDays(r.data.days)
        setBd(b.data)
    }, [from, to, by])
    useEffect(() => { load() }, [load])

    const sum = (k: keyof Day) => days.reduce((n, d) => n + (d[k] as number), 0)
    const totals: [string, string][] = [
        ['Conversations', String(sum('conversations'))],
        ['Leads', String(sum('leads'))],
        ['HOT leads', String(sum('hotLeads'))],
        ['Handoffs', String(sum('handoffs'))],
        ['👍 / 👎', `${sum('thumbsUp')} / ${sum('thumbsDown')}`],
        ['Estimated cost', `$${sum('costUsd').toFixed(2)}`],
    ]

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='AI usage' subtitle='استخدام المساعد الذكي وتكلفته (توقيت القاهرة)'>
                <div className='flex items-end gap-2'>
                    <label className='text-xs text-gray-600'>From<input type='date' className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label className='text-xs text-gray-600'>To<input type='date' className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                    <button className={btnGhost} onClick={load}>Refresh</button>
                </div>
            </PageHeader>
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}

            <div className='grid grid-cols-2 md:grid-cols-6 gap-3'>
                {totals.map(([label, value]) => (
                    <Card key={label}><div className='text-xs text-gray-500'>{label}</div><div className='text-xl font-semibold'>{value}</div></Card>
                ))}
            </div>

            <div className='overflow-auto bg-white rounded-lg shadow-sm'>
                <table className='w-full text-sm text-right text-gray-600'>
                    <thead className='text-xs uppercase bg-gray-50 text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 text-left'>Day</th><th className='px-4 py-3'>Conversations</th><th className='px-4 py-3'>Leads</th>
                            <th className='px-4 py-3'>HOT</th><th className='px-4 py-3'>Handoffs</th><th className='px-4 py-3'>👍</th><th className='px-4 py-3'>👎</th>
                            <th className='px-4 py-3'>Tokens in</th><th className='px-4 py-3'>Tokens out</th><th className='px-4 py-3'>Cost (USD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...days].reverse().map((d) => (
                            <tr key={d.date} className='border-t'>
                                <td className='px-4 py-2 text-left whitespace-nowrap'>{d.date}</td>
                                <td className='px-4 py-2'>{d.conversations}</td><td className='px-4 py-2'>{d.leads}</td><td className='px-4 py-2'>{d.hotLeads}</td>
                                <td className='px-4 py-2'>{d.handoffs}</td><td className='px-4 py-2'>{d.thumbsUp}</td><td className='px-4 py-2'>{d.thumbsDown}</td>
                                <td className='px-4 py-2'>{d.tokensIn.toLocaleString()}</td><td className='px-4 py-2'>{d.tokensOut.toLocaleString()}</td>
                                <td className='px-4 py-2'>{d.costUsd.toFixed(4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {bd && (
                <>
                    <div className='grid gap-6 lg:grid-cols-2'>
                        <section className='bg-white rounded-lg shadow-sm overflow-auto'>
                            <h2 className='px-4 pt-4 font-semibold text-gray-800'>Cost by model</h2>
                            <table className='w-full text-sm text-right text-gray-600 mt-2'>
                                <thead className='text-xs uppercase bg-gray-50 text-gray-500'>
                                    <tr><th className={clsx(th, 'text-left')}>Model</th><th className={th}>Calls</th><th className={th}>Tokens in</th><th className={th}>Tokens out</th><th className={th}>Cost (USD)</th></tr>
                                </thead>
                                <tbody>
                                    {bd.models.map((m) => (
                                        <tr key={m.model} className='border-t'>
                                            <td className={clsx(td, 'text-left font-mono text-xs')}>{m.model}</td><td className={td}>{m.calls}</td>
                                            <td className={td}>{m.tokensIn.toLocaleString()}</td><td className={td}>{m.tokensOut.toLocaleString()}</td><td className={td}>{m.costUsd.toFixed(4)}</td>
                                        </tr>
                                    ))}
                                    {!bd.models.length && <tr><td colSpan={5} className='px-4 py-6 text-center text-gray-400'>No model calls logged in this range.</td></tr>}
                                </tbody>
                            </table>
                        </section>
                        <section className='bg-white rounded-lg shadow-sm overflow-auto'>
                            <h2 className='px-4 pt-4 font-semibold text-gray-800'>Cost per UTC day</h2>
                            <p className='px-4 text-xs text-gray-500'>The Anthropic console groups by UTC day; the table above uses Cairo time. The console can also lag by a few hours.</p>
                            <table className='w-full text-sm text-right text-gray-600 mt-2'>
                                <thead className='text-xs uppercase bg-gray-50 text-gray-500'><tr><th className={clsx(th, 'text-left')}>UTC day</th><th className={th}>Cost (USD)</th></tr></thead>
                                <tbody>
                                    {[...bd.utcDays].reverse().map((d) => (
                                        <tr key={d.date} className='border-t'><td className={clsx(td, 'text-left')}>{d.date}</td><td className={td}>{d.costUsd.toFixed(4)}</td></tr>
                                    ))}
                                    {!bd.utcDays.length && <tr><td colSpan={2} className='px-4 py-6 text-center text-gray-400'>No model calls logged in this range.</td></tr>}
                                </tbody>
                            </table>
                        </section>
                    </div>

                    <section className='bg-white rounded-lg shadow-sm overflow-auto'>
                        <div className='flex flex-wrap items-center justify-between gap-2 px-4 pt-4'>
                            <div>
                                <h2 className='font-semibold text-gray-800'>Cost per visitor</h2>
                                <p className='text-xs text-gray-500'>Signed-in account, else the guest&apos;s browser session. IPs are stored hashed only. Top 100 by cost.</p>
                            </div>
                            <div role='group' aria-label='Group by' className='inline-flex rounded border border-gray-300 overflow-hidden text-sm'>
                                {(['visitor', 'ip'] as const).map((k) => (
                                    <button key={k} type='button' aria-pressed={by === k} onClick={() => setBy(k)}
                                        className={clsx('px-3 py-1.5', by === k ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50')}>
                                        {k === 'visitor' ? 'By visitor' : 'By IP'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <table className='w-full text-sm text-right text-gray-600 mt-2'>
                            <thead className='text-xs uppercase bg-gray-50 text-gray-500'>
                                <tr>
                                    <th className={clsx(th, 'text-left')}>Visitor</th><th className={th}>Type</th><th className={th}>Conversations</th><th className={th}>Messages</th>
                                    <th className={th}>Tokens in</th><th className={th}>Tokens out</th><th className={th}>Cost (USD)</th><th className={th}>Last seen</th><th className={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {bd.visitors.map((v) => (
                                    <tr key={v.key} className='border-t'>
                                        <td className={clsx(td, 'text-left')}>
                                            <div className='font-medium text-gray-800' dir='auto'>{v.label}</div>
                                            {v.detail && v.detail !== v.label && <div className='text-xs text-gray-400'>{v.detail}</div>}
                                        </td>
                                        <td className={td}>{KIND_LABEL[v.kind]}</td><td className={td}>{v.conversations}</td><td className={td}>{v.messages}</td>
                                        <td className={td}>{v.tokensIn.toLocaleString()}</td><td className={td}>{v.tokensOut.toLocaleString()}</td>
                                        <td className={clsx(td, 'font-medium')}>{v.costUsd.toFixed(4)}</td><td className={clsx(td, 'whitespace-nowrap')}>{fmtDate(v.lastSeen)}</td>
                                        <td className={td}><LocaleLink href={`/dashboard/conversations/${v.latestConversationId}`} className='text-blue-600 hover:underline whitespace-nowrap'>Latest chat →</LocaleLink></td>
                                    </tr>
                                ))}
                                {!bd.visitors.length && <tr><td colSpan={9} className='px-4 py-6 text-center text-gray-400'>No visitor costs logged in this range (tracking started with this update).</td></tr>}
                            </tbody>
                        </table>
                    </section>
                </>
            )}
        </div>
    )
}
