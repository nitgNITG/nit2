'use client'
// Follow-ups (phase 4, US-22, US-32, FR-F3): messages the AI drafted for due
// leads, unpaid checkouts and consented visitors who did not come back. Nothing
// goes out until someone here edits (optional) and clicks Send.
import React, { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import LocaleLink from '../../components/LocaleLink'
import { api, btnGhost, btnPrimary, Card, errorText, fmtDate, PageHeader, TierBadge } from '../components/agent/ui'

type Item = {
    id: string; status: string; content: string; createdAt: string; conversationId: string; conversationChannel: string | null
    followup: { kind: 'due' | 'checkout' | 'abandoned'; channel: 'whatsapp' | 'email'; to: string; locale: 'ar' | 'en'; plan?: string; via?: string; sentAt?: string; decidedAt?: string; error?: string }
    contact: { id: string; name: string; tier: string | null; score: number; status: string; consentContact: boolean | null } | null
}
const KIND: Record<Item['followup']['kind'], { label: string; tone: string }> = {
    due: { label: 'Follow-up date today', tone: 'bg-blue-50 text-blue-800' },
    checkout: { label: 'Checkout not paid', tone: 'bg-amber-50 text-amber-800' },
    abandoned: { label: "Didn't come back", tone: 'bg-purple-50 text-purple-800' },
}
const TABS = [['draft', 'Waiting for approval'], ['sent', 'Sent'], ['discarded', 'Discarded']] as const

function DraftCard({ item, onDone }: { item: Item; onDone: () => void }) {
    const [text, setText] = useState(item.content)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(item.followup.error ? `Last attempt failed: ${item.followup.error}` : '')
    const draft = item.status === 'draft'
    const f = item.followup

    const decide = async (action: 'send' | 'discard') => {
        if (action === 'discard' && !confirm('Discard this draft? It will not be sent.')) return
        setBusy(true); setError('')
        const r = await api(`/api/agent/admin/messages/${item.id}`, { method: 'PATCH', body: JSON.stringify({ action, ...(action === 'send' && text !== item.content ? { content: text } : {}) }) })
        setBusy(false)
        if (!r.ok) return setError(errorText(r))
        onDone()
    }

    return (
        <Card className='space-y-3'>
            <div className='flex flex-wrap items-center gap-2 text-sm'>
                <span className={clsx('rounded px-2 py-0.5 text-xs font-semibold', KIND[f.kind].tone)}>{KIND[f.kind].label}</span>
                <span className='font-medium text-gray-800' dir='auto'>{item.contact?.name ?? 'Lead'}</span>
                {item.contact?.tier && <TierBadge tier={item.contact.tier} />}
                <span className='text-xs text-gray-500'>
                    {f.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} → <span dir='ltr' className='font-mono'>{f.to}</span>
                    {f.plan ? ` · ${f.plan}` : ''} · drafted {fmtDate(item.createdAt)}
                    {f.sentAt ? ` · sent ${fmtDate(f.sentAt)}${f.via === 'template' ? ' (template)' : ''}` : ''}
                </span>
                <LocaleLink href={`/dashboard/conversations/${item.conversationId}`} className='ms-auto text-xs text-blue-600 hover:underline'>Conversation →</LocaleLink>
            </div>
            {draft ? (
                <textarea aria-label='Message' dir='auto' rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
                    className='w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500' />
            ) : (
                <p className='whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-800' dir='auto'>{item.content}</p>
            )}
            {draft && f.channel === 'whatsapp' && (
                <p className='text-xs text-gray-500'>Sent as free text if the customer wrote on WhatsApp in the last 24 h; otherwise through your approved template, with this text as its message.</p>
            )}
            {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
            {draft && (
                <div className='flex gap-2'>
                    <button type='button' className={btnPrimary} disabled={busy || !text.trim()} onClick={() => decide('send')}>Approve &amp; send</button>
                    <button type='button' className={btnGhost} disabled={busy} onClick={() => decide('discard')}>Discard</button>
                </div>
            )}
        </Card>
    )
}

export default function FollowUpsPage() {
    const [tab, setTab] = useState<(typeof TABS)[number][0]>('draft')
    const [items, setItems] = useState<Item[] | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const r = await api<{ items: Item[] }>(`/api/agent/admin/followups?status=${tab}`)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setItems(r.data.items)
    }, [tab])
    useEffect(() => { setItems(null); load() }, [load])

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-5'>
            <PageHeader title='Follow-ups' subtitle='متابعات يكتبها المساعد الذكي — لا يُرسل شيء قبل موافقتك'>
                <button type='button' className={btnGhost} onClick={load}>Refresh</button>
            </PageHeader>
            <p className='text-sm text-gray-600'>
                Each morning the AI drafts messages for leads whose follow-up date is today, checkouts started in chat but not paid, and visitors who left a number,
                agreed to be contacted and didn&apos;t come back. Review, edit if needed, then approve — or discard.
            </p>
            <div role='tablist' className='inline-flex overflow-hidden rounded border border-gray-300 text-sm'>
                {TABS.map(([k, label]) => (
                    <button key={k} role='tab' aria-selected={tab === k} onClick={() => setTab(k)}
                        className={clsx('px-3 py-1.5', tab === k ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50')}>{label}</button>
                ))}
            </div>
            {error && <div role='alert' className='rounded bg-red-50 p-3 text-red-700'>{error}</div>}
            {!items ? <p className='text-gray-400'>Loading…</p> : !items.length ? (
                <Card className='text-center text-sm text-gray-500'>{tab === 'draft' ? 'No drafts waiting. New ones appear after the daily job runs.' : 'Nothing here yet.'}</Card>
            ) : (
                <div className='space-y-3'>{items.map((i) => <DraftCard key={i.id} item={i} onDone={load} />)}</div>
            )}
        </div>
    )
}
