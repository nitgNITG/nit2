'use client'
// Meeting requests from the AI assistant (FR-S16, E21). Sales confirms with the visitor.
import React, { useCallback, useEffect, useState } from 'react'
import LocaleLink from '../../components/LocaleLink'
import { api, Card, errorText, inputCls, PageHeader, TierBadge } from '../components/agent/ui'

type Meeting = {
    id: string; conversationId: string; preferredAt: string; channel: string; status: string; notes: string | null
    contact: { id: string; name: string; phone: string | null; email: string; tier: string | null } | null
}
const CHANNEL: Record<string, string> = { call: '📞 Call', online: '💻 Online meeting', visit: '🏢 Visit' }
const STATUSES = [['requested', 'Requested'], ['confirmed', 'Confirmed'], ['done', 'Done'], ['cancelled', 'Cancelled']] as const
const cairo = (d: string) => new Date(d).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function MeetingsPage() {
    const [items, setItems] = useState<Meeting[]>([])
    const [filter, setFilter] = useState('requested')
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const r = await api<{ items: Meeting[] }>(`/api/agent/admin/meetings${filter ? `?status=${filter}` : ''}`)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setItems(r.data.items)
    }, [filter])
    useEffect(() => { load() }, [load])

    const setStatus = async (id: string, status: string) => {
        const r = await api(`/api/agent/admin/meetings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
        if (!r.ok) return setError(errorText(r))
        load()
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='Meeting requests' subtitle='طلبات الاجتماعات (بتوقيت القاهرة)'>
                <select aria-label='Status' className={`${inputCls} w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value=''>All</option>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
            </PageHeader>
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}
            <div className='space-y-3'>
                {items.map((m) => (
                    <Card key={m.id} className='flex flex-wrap gap-4 justify-between items-start'>
                        <div className='space-y-1'>
                            <div className='font-semibold'>{cairo(m.preferredAt)} · {CHANNEL[m.channel] ?? m.channel}</div>
                            {m.contact
                                ? <div className='text-sm flex items-center gap-2'>{m.contact.name} <TierBadge tier={m.contact.tier} /> <span dir='ltr'>{m.contact.phone ?? ''}</span> {m.contact.email}</div>
                                : <div className='text-sm text-gray-500'>No contact details yet — see the conversation.</div>}
                            {m.notes && <div className='text-sm text-gray-700' dir='auto'>“{m.notes}”</div>}
                            <LocaleLink href={`/dashboard/conversations/${m.conversationId}`} className='text-sm text-blue-600 hover:underline'>Open the conversation →</LocaleLink>
                        </div>
                        <select aria-label='Meeting status' className={`${inputCls} w-40`} value={m.status} onChange={(e) => setStatus(m.id, e.target.value)}>
                            {STATUSES.map(([v, l]) => <option key={v} value={v} disabled={v === 'requested'}>{l}</option>)}
                        </select>
                    </Card>
                ))}
                {!items.length && <Card className='text-center text-gray-400'>No meeting requests here.</Card>}
            </div>
        </div>
    )
}
