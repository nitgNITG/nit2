'use client'
// Support tickets opened by the AI assistant (FR-P7, E14).
import React, { useCallback, useEffect, useState } from 'react'
import LocaleLink from '../../components/LocaleLink'
import { api, Card, errorText, fmtDate, inputCls, PageHeader } from '../components/agent/ui'

type Ticket = { id: string; conversationId: string; userId: string; tenantSlug: string | null; category: string; summary: string; status: string; createdAt: string }
const STATUSES = [['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved']] as const

export default function TicketsPage() {
    const [items, setItems] = useState<Ticket[]>([])
    const [filter, setFilter] = useState('open')
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const r = await api<{ items: Ticket[] }>(`/api/agent/admin/tickets${filter ? `?status=${filter}` : ''}`)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setItems(r.data.items)
    }, [filter])
    useEffect(() => { load() }, [load])

    const setStatus = async (id: string, status: string) => {
        const r = await api(`/api/agent/admin/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
        if (!r.ok) return setError(errorText(r))
        load()
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='Support tickets' subtitle='تذاكر الدعم من المساعد الذكي'>
                <select aria-label='Status' className={`${inputCls} w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value=''>All</option>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
            </PageHeader>
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}
            <div className='space-y-3'>
                {items.map((t) => (
                    <Card key={t.id} className='flex flex-wrap gap-4 justify-between items-start'>
                        <div className='space-y-1 max-w-3xl'>
                            <div className='text-sm text-gray-500'>
                                #{t.id.slice(-6).toUpperCase()} · {t.category} · {fmtDate(t.createdAt)}{t.tenantSlug ? ` · ${t.tenantSlug}` : ''}
                            </div>
                            <div className='text-gray-800 whitespace-pre-wrap' dir='auto'>{t.summary}</div>
                            <LocaleLink href={`/dashboard/conversations/${t.conversationId}`} className='text-sm text-blue-600 hover:underline'>Open the conversation →</LocaleLink>
                        </div>
                        <select aria-label='Ticket status' className={`${inputCls} w-40`} value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </Card>
                ))}
                {!items.length && <Card className='text-center text-gray-400'>No tickets here.</Card>}
            </div>
        </div>
    )
}
