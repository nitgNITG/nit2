'use client'
// AI analytics (FR-N2, FR-N3, US-31): what visitors ask, what the assistant
// could not answer (answer it here → it joins the knowledge notes), services,
// countries, budgets, tiers, handoff rate, abandoned chats and chat-to-paid.
import React, { useCallback, useEffect, useState } from 'react'
import LocaleLink from '../../components/LocaleLink'
import { api, btnGhost, btnPrimary, Card, errorText, fmtDate, inputCls, PageHeader } from '../components/agent/ui'

type Count = { key: string; n: number }
type Report = {
    conversations: number; tagged: number; topQuestions: Count[]
    unknownQuestions: { conversationId: string; question: string; locale: 'ar' | 'en'; at: string }[]
    services: Count[]; countries: Count[]; budgets: Count[]; tiers: Count[]
    handoffRate: number; abandoned: number; chatToPaid: number
}
const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
const minusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function Bars({ title, rows }: { title: string; rows: Count[] }) {
    const max = Math.max(1, ...rows.map((r) => r.n))
    return (
        <Card className='space-y-2'>
            <h5 className='font-semibold text-sm'>{title}</h5>
            {rows.length ? rows.slice(0, 10).map((r) => (
                <div key={r.key} className='text-xs'>
                    <div className='flex justify-between'><span>{r.key}</span><span className='text-gray-500'>{r.n}</span></div>
                    <div className='h-1.5 bg-gray-100 rounded'><div className='h-1.5 bg-[#1E7D67] rounded' style={{ width: `${(r.n / max) * 100}%` }} /></div>
                </div>
            )) : <div className='text-xs text-gray-400'>No data yet.</div>}
        </Card>
    )
}

function UnknownRow({ q, onAnswered }: { q: Report['unknownQuestions'][number]; onAnswered: () => void }) {
    const [open, setOpen] = useState(false)
    const [answer, setAnswer] = useState('')
    const [err, setErr] = useState('')
    const [busy, setBusy] = useState(false)
    const save = async () => {
        setBusy(true)
        setErr('')
        const r = await api('/api/agent/admin/analytics/answer', { method: 'POST', body: JSON.stringify({ ...q, answer }) })
        setBusy(false)
        if (!r.ok) return setErr(errorText(r))
        onAnswered()
    }
    return (
        <div className='border-t py-2 text-sm space-y-1'>
            <div className='flex justify-between gap-3'>
                <span dir='auto' className='text-gray-800'>“{q.question}”</span>
                <span className='text-xs text-gray-400 whitespace-nowrap'>{q.locale} · {fmtDate(q.at)} · <LocaleLink className='text-blue-600' href={`/dashboard/conversations/${q.conversationId}`}>chat</LocaleLink></span>
            </div>
            {!open && <button className='text-xs text-blue-600 underline' onClick={() => setOpen(true)}>Write an answer</button>}
            {open && (
                <div className='space-y-1'>
                    <textarea aria-label='Answer' dir={q.locale === 'ar' ? 'rtl' : 'ltr'} rows={3} className={inputCls} value={answer} onChange={(e) => setAnswer(e.target.value)}
                        placeholder={q.locale === 'ar' ? 'الإجابة الصحيحة التي يجب أن يقولها المساعد' : 'The correct answer the assistant should give'} />
                    {err && <div role='alert' className='text-xs text-red-700'>{err}</div>}
                    <div className='flex gap-2'>
                        <button className={btnPrimary} disabled={busy || answer.trim().length < 2} onClick={save}>Add to knowledge notes</button>
                        <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function AgentAnalyticsPage() {
    const [to, setTo] = useState(cairoToday())
    const [from, setFrom] = useState(minusDays(cairoToday(), 29))
    const [r, setR] = useState<Report | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const res = await api<Report>(`/api/agent/admin/analytics?from=${from}&to=${to}`)
        if (!res.ok) return setError(errorText(res))
        setError('')
        setR(res.data)
    }, [from, to])
    useEffect(() => { load() }, [load])

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='AI analytics' subtitle='تحليلات المساعد الذكي'>
                <div className='flex items-end gap-2'>
                    <label className='text-xs text-gray-600'>From<input type='date' className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                    <label className='text-xs text-gray-600'>To<input type='date' className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                </div>
            </PageHeader>
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}
            {r && (
                <>
                    <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
                        {([
                            ['Conversations', String(r.conversations)],
                            ['Analysed', `${r.tagged}`],
                            ['Handed to a person', pct(r.handoffRate)],
                            ['Abandoned', String(r.abandoned)],
                            ['Chat → paid', pct(r.chatToPaid)],
                        ] as const).map(([l, v]) => <Card key={l}><div className='text-xs text-gray-500'>{l}</div><div className='text-xl font-semibold'>{v}</div></Card>)}
                    </div>
                    <p className='text-xs text-gray-500'>
                        Conversations are analysed by the AI after they close (daily job). “Abandoned” = left after at most one reply without leaving details or reaching a person.
                        “Chat → paid” = the chatting account (or the lead’s email) paid for a plan after the chat.
                    </p>

                    <Card>
                        <h5 className='font-semibold'>Questions the assistant could not answer ({r.unknownQuestions.length})</h5>
                        <p className='text-xs text-gray-500 mb-2'>Write the right answer once — it is added to the knowledge notes and the assistant uses it from the next message. (Admins only.)</p>
                        {r.unknownQuestions.length
                            ? r.unknownQuestions.map((q) => <UnknownRow key={`${q.conversationId}:${q.question}`} q={q} onAnswered={load} />)
                            : <div className='text-sm text-gray-400'>None in this period.</div>}
                    </Card>

                    <div className='grid md:grid-cols-3 gap-4'>
                        <Bars title='Most-asked topics' rows={r.topQuestions} />
                        <Bars title='Services' rows={r.services} />
                        <Bars title='Countries' rows={r.countries} />
                        <Bars title='Lead tiers' rows={r.tiers} />
                        <Bars title='Budgets' rows={r.budgets} />
                    </div>
                </>
            )}
        </div>
    )
}
