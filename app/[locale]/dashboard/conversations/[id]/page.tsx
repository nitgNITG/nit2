'use client'
// One conversation (FR-I2, FR-I3, US-11, US-12, US-27, US-35): every message and
// tool call, the linked lead with tier / breakdown / AI brief, take over, reply,
// hand back. Polls every 4 s so visitor messages show up while a person handles it.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import LocaleLink from '../../../components/LocaleLink'
import { api, btnGhost, btnPrimary, Card, errorText, fmtDate, inputCls, StatusBadge, TierBadge } from '../../components/agent/ui'

type Msg = { id: string; role: string; content: string; toolName?: string | null; createdAt: string; staffId?: string | null; model?: string | null }
type Detail = {
    conversation: any
    messages: Msg[]
    contact: any | null
    summary: string | null
    viewer: { userId: string; isAdmin: boolean; canEditLead: boolean }
}

function ToolRow({ m }: { m: Msg }) {
    let parsed: any = null
    try { parsed = JSON.parse(m.content) } catch { /* show raw */ }
    return (
        <details className='text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 mx-8'>
            <summary className='cursor-pointer text-gray-600'>
                🔧 <span className='font-mono'>{m.toolName}</span>{' '}
                {parsed && (parsed.ok ? <span className='text-green-700'>ok</span> : <span className='text-red-700'>{parsed.code}</span>)}
                <span className='text-gray-400'> · {fmtDate(m.createdAt)}</span>
            </summary>
            <pre className='mt-2 whitespace-pre-wrap break-all text-gray-700'>{JSON.stringify(parsed?.input ?? m.content, null, 2)}</pre>
        </details>
    )
}

function Bubble({ m }: { m: Msg }) {
    if (m.role === 'tool') return <ToolRow m={m} />
    if (m.role === 'system') {
        return <div className='text-center text-xs text-gray-400'>— {m.content.replace(/_/g, ' ')} · {fmtDate(m.createdAt)} —</div>
    }
    const mine = m.role !== 'visitor'
    const color = m.role === 'visitor' ? 'bg-white border' : m.role === 'staff' ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-100'
    const who = m.role === 'visitor' ? 'Visitor' : m.role === 'staff' ? 'Team member' : 'AI assistant'
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${color}`}>
                <div className='text-[11px] text-gray-500 mb-1'>{who} · {fmtDate(m.createdAt)}{m.model ? ` · ${m.model}` : ''}</div>
                <div className='whitespace-pre-wrap text-sm text-gray-800' dir='auto'>{m.content}</div>
            </div>
        </div>
    )
}

const BOOL = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : '—')

function LeadPanel({ contact, summary, canEdit, onSaved }: { contact: any; summary: string | null; canEdit: boolean; onSaved: () => void }) {
    const req = contact.requirements ?? {}
    const [edit, setEdit] = useState(false)
    const [form, setForm] = useState({
        country: (contact.country ?? '').toUpperCase(), orgType: contact.orgType ?? '', timeline: contact.timeline ?? req.timeline ?? '',
        budgetMinUsd: req.budgetMinUsd ?? '', expectedUsers: req.expectedUsers ?? '', mobileApps: req.mobileApps ?? null,
    })
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')

    const save = async () => {
        setBusy(true)
        setErr('')
        const requirements: Record<string, unknown> = {}
        if (form.budgetMinUsd !== '') requirements.budgetMinUsd = Number(form.budgetMinUsd)
        if (form.expectedUsers !== '') requirements.expectedUsers = Number(form.expectedUsers)
        if (form.mobileApps !== null) requirements.mobileApps = form.mobileApps
        const r = await api(`/api/agent/admin/leads/${contact.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                country: form.country || null, orgType: form.orgType || null, timeline: form.timeline || null, requirements,
            }),
        })
        setBusy(false)
        if (!r.ok) return setErr(errorText(r))
        setEdit(false)
        onSaved()
    }

    return (
        <Card className='space-y-3'>
            <div className='flex items-center justify-between'>
                <h5 className='font-semibold'>Lead</h5>
                <TierBadge tier={contact.tier} />
            </div>
            <div className='text-sm space-y-0.5'>
                <div className='font-medium'>{contact.name}{contact.company ? ` · ${contact.company}` : ''}</div>
                {contact.email && <div>{contact.email}</div>}
                {contact.phone && <div dir='ltr'>{contact.phone}</div>}
                {contact.whatsapp && contact.whatsapp !== contact.phone && <div dir='ltr'>WhatsApp {contact.whatsapp}</div>}
                <div className='text-gray-500'>Consent to contact: {BOOL(contact.consentContact)}{contact.consentAt ? ` (${fmtDate(contact.consentAt)})` : ''}</div>
            </div>
            <div>
                <div className='text-sm'>Score <b>{contact.score}</b> · stage {contact.stage}</div>
                <table className='w-full text-xs mt-1'>
                    <tbody>
                        {(contact.scoreBreakdown ?? []).map((b: any) => (
                            <tr key={b.factor} className='border-t'><td className='py-0.5'>{b.factor.replace(/_/g, ' ')}</td><td className='text-right'>+{b.points}</td></tr>
                        ))}
                    </tbody>
                </table>
                {contact.scoredAt && <div className='text-[11px] text-gray-400 mt-1'>scored {fmtDate(contact.scoredAt)} · algorithm v{contact.scoreVersion} · settings v{contact.scoringConfigVersion}</div>}
            </div>
            {(contact.aiSummary || summary) && (
                <div className='bg-amber-50 border border-amber-200 rounded p-2 text-sm'>
                    <div className='text-[11px] font-semibold text-amber-800 mb-1'>AI-generated brief</div>
                    <div dir='auto'>{contact.aiSummary ?? summary}</div>
                    {contact.nextAction && <div className='mt-1 text-xs'>Next action: <b>{contact.nextAction.replace(/_/g, ' ')}</b></div>}
                </div>
            )}
            <div className='text-xs text-gray-600 grid grid-cols-2 gap-x-2 gap-y-0.5'>
                <span>Project</span><span>{req.projectType ?? '—'}</span>
                <span>Users</span><span>{req.expectedUsers ?? '—'}</span>
                <span>Mobile apps</span><span>{BOOL(req.mobileApps)}</span>
                <span>Payments</span><span>{BOOL(req.paymentGateway)}</span>
                <span>Video protection</span><span>{BOOL(req.videoProtection)}</span>
                <span>Budget (USD)</span><span>{req.budgetMinUsd ?? '—'}{req.budgetMaxUsd ? `–${req.budgetMaxUsd}` : ''}</span>
                <span>Timeline</span><span>{req.timeline ?? contact.timeline ?? '—'}</span>
                <span>Country</span><span>{(req.country ?? contact.country ?? '—').toString().toUpperCase()}</span>
            </div>
            {canEdit && !edit && <button className={btnGhost} onClick={() => setEdit(true)}>Correct scoring details</button>}
            {canEdit && edit && (
                <div className='space-y-2 text-xs'>
                    <label className='block'>Country (ISO-2)<input className={inputCls} maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} /></label>
                    <label className='block'>Organisation
                        <select className={inputCls} value={form.orgType} onChange={(e) => setForm({ ...form, orgType: e.target.value })}>
                            <option value=''>—</option><option value='individual'>Individual</option><option value='company'>Company</option>
                            <option value='government'>Government</option><option value='education'>Education</option>
                        </select>
                    </label>
                    <label className='block'>Budget from (USD)<input type='number' min={0} className={inputCls} value={form.budgetMinUsd} onChange={(e) => setForm({ ...form, budgetMinUsd: e.target.value })} /></label>
                    <label className='block'>Expected users<input type='number' min={1} className={inputCls} value={form.expectedUsers} onChange={(e) => setForm({ ...form, expectedUsers: e.target.value })} /></label>
                    <label className='block'>Timeline
                        <select className={inputCls} value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })}>
                            <option value=''>—</option><option value='immediate'>Immediate</option><option value='1to3months'>1–3 months</option>
                            <option value='3to6months'>3–6 months</option><option value='exploring'>Exploring</option>
                        </select>
                    </label>
                    <label className='flex items-center gap-2'><input type='checkbox' checked={!!form.mobileApps} onChange={(e) => setForm({ ...form, mobileApps: e.target.checked })} /> Needs mobile apps</label>
                    {err && <div role='alert' className='text-red-700'>{err}</div>}
                    <div className='flex gap-2'>
                        <button className={btnPrimary} disabled={busy} onClick={save}>Save & re-score</button>
                        <button className={btnGhost} onClick={() => setEdit(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </Card>
    )
}

export default function ConversationPage({ params }: { params: { id: string } }) {
    const [d, setD] = useState<Detail | null>(null)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [reply, setReply] = useState('')
    const [busy, setBusy] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)
    const count = useRef(0)

    const load = useCallback(async () => {
        const r = await api<Detail>(`/api/agent/admin/conversations/${params.id}`)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setD(r.data)
    }, [params.id])

    useEffect(() => {
        load()
        const t = setInterval(load, 4000)
        return () => clearInterval(t)
    }, [load])

    useEffect(() => {
        if (d && d.messages.length !== count.current) {
            count.current = d.messages.length
            endRef.current?.scrollIntoView({ block: 'end' })
        }
    }, [d])

    const act = async (path: string, body?: unknown) => {
        setBusy(true)
        setNotice('')
        const r = await api(`/api/agent/admin/conversations/${params.id}/${path}`, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
        setBusy(false)
        if (!r.ok) setNotice(errorText(r))
        await load()
        return r.ok
    }

    if (error && !d) return <div className='dashboard-container py-10'><div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div></div>
    if (!d) return <div className='dashboard-container py-10 text-gray-400'>Loading…</div>

    const c = d.conversation
    const mine = c.status === 'human' && (c.assignedTo === d.viewer.userId || d.viewer.isAdmin)

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-4'>
            <div className='flex flex-wrap items-center gap-3 justify-between'>
                <div className='space-y-1'>
                    <LocaleLink href='/dashboard/conversations' className='text-sm text-blue-600 hover:underline'>← AI Inbox</LocaleLink>
                    <div className='flex items-center gap-2'>
                        <StatusBadge status={c.status} />
                        <span className='text-sm text-gray-500'>{c.mode} · {c.channel} · {c.locale} · started {fmtDate(c.createdAt)}{c.sourcePage ? ` on ${c.sourcePage}` : ''}</span>
                    </div>
                </div>
                <div className='flex gap-2'>
                    {(c.status === 'open' || c.status === 'waiting_human') && <button className={btnPrimary} disabled={busy} onClick={() => act('takeover')}>Take over</button>}
                    {c.status === 'human' && mine && <button className={btnGhost} disabled={busy} onClick={() => act('release')}>Hand back to AI</button>}
                    {c.status === 'human' && !mine && <span className='text-sm text-gray-500'>Another team member is handling this.</span>}
                </div>
            </div>
            {notice && <div role='alert' className='bg-amber-50 text-amber-800 p-3 rounded text-sm'>{notice}</div>}

            <div className='grid lg:grid-cols-[1fr_340px] gap-4 items-start'>
                <Card className='space-y-3'>
                    {d.summary && <div className='text-sm bg-gray-50 rounded p-2'><span className='text-[11px] font-semibold text-gray-500'>Summary (AI-generated): </span>{d.summary}</div>}
                    <div className='space-y-2 max-h-[65vh] overflow-y-auto pr-1'>
                        {d.messages.map((m) => <Bubble key={m.id} m={m} />)}
                        <div ref={endRef} />
                    </div>
                    {mine ? (
                        <form
                            className='flex gap-2 items-end border-t pt-3'
                            onSubmit={async (e) => {
                                e.preventDefault()
                                if (!reply.trim()) return
                                if (await act('messages', { content: reply.trim() })) setReply('')
                            }}
                        >
                            <textarea aria-label='Reply to the visitor' dir='auto' rows={2} maxLength={4000} className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} placeholder='Write to the visitor…' />
                            <button className={btnPrimary} disabled={busy || !reply.trim()}>Send</button>
                        </form>
                    ) : (
                        <div className='border-t pt-3 text-sm text-gray-500'>Take over to reply. While a person handles it, the AI does not answer.</div>
                    )}
                </Card>

                <div className='space-y-4'>
                    {d.contact
                        ? <LeadPanel key={d.contact.scoredAt ?? d.contact.id} contact={d.contact} summary={d.summary} canEdit={d.viewer.canEditLead} onSaved={load} />
                        : <Card className='text-sm text-gray-500'>No lead captured yet.</Card>}
                    {c.rating != null && (
                        <Card className='text-sm'>Visitor rating: {c.rating === 1 ? '👍' : '👎'}{c.ratingComment ? <div className='text-gray-600 mt-1' dir='auto'>“{c.ratingComment}”</div> : null}</Card>
                    )}
                </div>
            </div>
        </div>
    )
}
