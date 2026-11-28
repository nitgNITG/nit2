'use client'
// The lead's CRM timeline of AI conversation events (FR-I4). Shown in the
// Contacts popup and in the AI Inbox lead panel.
import React, { useEffect, useState } from 'react'
import LocaleLink from '../../../components/LocaleLink'
import { api, errorText, fmtDate, TierBadge } from './ui'

type Item = {
    id: string; event: string; channel: string; conversationId: string; score: number | null; tier: string | null
    summary: string | null; createdByName: string; createdAt: string
}

const EVENT: Record<string, { label: string; icon: string }> = {
    AI_CONVERSATION_STARTED: { label: 'AI conversation', icon: '💬' },
    AI_LEAD_QUALIFIED: { label: 'Qualified by the AI', icon: '⭐' },
    AI_HANDOFF: { label: 'Handed to a person', icon: '🙋' },
    HUMAN_TAKEOVER: { label: 'Taken over by staff', icon: '🧑‍💼' },
    AI_FOLLOWUP_APPROVED: { label: 'Follow-up approved', icon: '✅' },
}

export default function LeadTimeline({ contactId, refreshKey }: { contactId: string; refreshKey?: unknown }) {
    const [items, setItems] = useState<Item[] | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        api<{ items: Item[] }>(`/api/agent/admin/leads/${contactId}/activity`).then((r) => {
            if (cancelled) return
            if (r.ok) setItems(r.data.items)
            else if (r.status !== 403) setError(errorText(r)) // no "leads" permission → nothing to show
        })
        return () => { cancelled = true }
    }, [contactId, refreshKey])

    if (error) return <p className='text-xs text-red-600'>{error}</p>
    if (!items) return <p className='text-xs text-gray-400'>Loading timeline…</p>
    if (!items.length) return <p className='text-xs text-gray-400'>No AI conversation activity yet.</p>

    return (
        <ol className='relative space-y-3 border-s border-gray-200 ps-4'>
            {items.map((a) => {
                const e = EVENT[a.event] ?? { label: a.event, icon: '•' }
                return (
                    <li key={a.id} className='relative'>
                        <span aria-hidden className='absolute -start-[1.6rem] top-0 flex size-5 items-center justify-center rounded-full bg-white text-xs ring-1 ring-gray-200'>{e.icon}</span>
                        <div className='flex flex-wrap items-center gap-2 text-sm'>
                            <span className='font-medium text-gray-800'>{e.label}</span>
                            {a.tier && <TierBadge tier={a.tier} />}
                            {a.score != null && <span className='text-xs text-gray-500'>score {a.score}</span>}
                            <span className='text-xs text-gray-400'>{a.channel} · {fmtDate(a.createdAt)} · {a.createdByName}</span>
                        </div>
                        {a.summary && <p className='text-xs text-gray-600' dir='auto'>{a.summary}</p>}
                        <LocaleLink href={`/dashboard/conversations/${a.conversationId}`} className='text-xs text-blue-600 hover:underline'>Open conversation →</LocaleLink>
                    </li>
                )
            })}
        </ol>
    )
}
