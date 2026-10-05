'use client'
// AI usage (FR-C3, US-14): conversations, leads, handoffs, ratings, tokens and cost per day.
import React, { useCallback, useEffect, useState } from 'react'
import { api, btnGhost, Card, errorText, inputCls, PageHeader } from '../components/agent/ui'

type Day = {
    date: string; conversations: number; leads: number; hotLeads: number; handoffs: number
    thumbsUp: number; thumbsDown: number; tokensIn: number; tokensOut: number; costUsd: number
}
const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
const minusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

export default function AgentUsagePage() {
    const [to, setTo] = useState(cairoToday())
    const [from, setFrom] = useState(minusDays(cairoToday(), 13))
    const [days, setDays] = useState<Day[]>([])
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const r = await api<{ days: Day[] }>(`/api/agent/admin/usage?from=${from}&to=${to}`)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setDays(r.data.days)
    }, [from, to])
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
        </div>
    )
}
