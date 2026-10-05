'use client'
// AI inbox (FR-I1): conversations with filters; refreshes every 15 s.
import React, { useCallback, useEffect, useState } from 'react'
import LocaleLink from '../../components/LocaleLink'
import { api, Card, errorText, fmtDate, inputCls, PageHeader, StatusBadge, TierBadge, btnGhost } from '../components/agent/ui'

type Item = {
    id: string; channel: string; mode: string; status: string; locale: string; lastMessageAt: string
    contact: { id: string; name: string; tier?: string | null; score?: number; country?: string | null } | null
    preview: string; rating: number | null; assignedTo: string | null
}
const PAGE = 20

export default function ConversationsPage() {
    const [filters, setFilters] = useState({ status: '', mode: '', channel: '', hasLead: '', from: '', to: '' })
    const [skip, setSkip] = useState(0)
    const [data, setData] = useState<{ total: number; items: Item[] }>({ total: 0, items: [] })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        const qs = new URLSearchParams({ skip: String(skip), take: String(PAGE) })
        for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v)
        const r = await api(`/api/agent/admin/conversations?${qs}`)
        setLoading(false)
        if (!r.ok) return setError(errorText(r))
        setError('')
        setData(r.data)
    }, [filters, skip])

    useEffect(() => {
        load()
        const t = setInterval(load, 15_000)
        return () => clearInterval(t)
    }, [load])

    const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setSkip(0)
        setFilters((f) => ({ ...f, [k]: e.target.value }))
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='AI Inbox' subtitle='محادثات المساعد الذكي'>
                <button className={btnGhost} onClick={load}>Refresh</button>
            </PageHeader>

            <Card className='grid grid-cols-2 md:grid-cols-6 gap-3'>
                <label className='text-xs text-gray-600'>Status
                    <select aria-label='Status' className={inputCls} value={filters.status} onChange={set('status')}>
                        <option value=''>All</option>
                        <option value='open'>AI answering</option>
                        <option value='waiting_human'>Waiting for a person</option>
                        <option value='human'>With a person</option>
                        <option value='closed'>Closed</option>
                    </select>
                </label>
                <label className='text-xs text-gray-600'>Mode
                    <select aria-label='Mode' className={inputCls} value={filters.mode} onChange={set('mode')}>
                        <option value=''>All I can see</option>
                        <option value='sales'>Sales</option>
                        <option value='support'>Support</option>
                    </select>
                </label>
                <label className='text-xs text-gray-600'>Channel
                    <select aria-label='Channel' className={inputCls} value={filters.channel} onChange={set('channel')}>
                        <option value=''>All</option>
                        <option value='web'>Website</option>
                        <option value='whatsapp'>WhatsApp</option>
                    </select>
                </label>
                <label className='text-xs text-gray-600'>Lead
                    <select aria-label='Has lead' className={inputCls} value={filters.hasLead} onChange={set('hasLead')}>
                        <option value=''>Any</option>
                        <option value='true'>With lead</option>
                        <option value='false'>No lead</option>
                    </select>
                </label>
                <label className='text-xs text-gray-600'>From<input type='date' className={inputCls} value={filters.from} onChange={set('from')} /></label>
                <label className='text-xs text-gray-600'>To<input type='date' className={inputCls} value={filters.to} onChange={set('to')} /></label>
            </Card>

            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}

            <div className='overflow-auto bg-white rounded-lg shadow-sm'>
                <table className='w-full text-sm text-left text-gray-600'>
                    <thead className='text-xs uppercase bg-gray-50 text-gray-500'>
                        <tr>
                            <th className='px-4 py-3'>Last activity</th>
                            <th className='px-4 py-3'>Status</th>
                            <th className='px-4 py-3'>Lead</th>
                            <th className='px-4 py-3'>Tier</th>
                            <th className='px-4 py-3'>Last message</th>
                            <th className='px-4 py-3'>Mode · channel</th>
                            <th className='px-4 py-3'>Rating</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((c) => (
                            <tr key={c.id} className='border-t hover:bg-gray-50'>
                                <td className='px-4 py-3 whitespace-nowrap'>
                                    <LocaleLink href={`/dashboard/conversations/${c.id}`} className='text-blue-600 hover:underline'>{fmtDate(c.lastMessageAt)}</LocaleLink>
                                </td>
                                <td className='px-4 py-3'><StatusBadge status={c.status} /></td>
                                <td className='px-4 py-3'>{c.contact ? `${c.contact.name}${c.contact.country ? ` (${c.contact.country.toUpperCase()})` : ''}` : <span className='text-gray-400'>—</span>}</td>
                                <td className='px-4 py-3'><TierBadge tier={c.contact?.tier} /></td>
                                <td className='px-4 py-3 max-w-md truncate' dir='auto' title={c.preview}>{c.preview}</td>
                                <td className='px-4 py-3 whitespace-nowrap'>{c.mode} · {c.channel} · {c.locale}</td>
                                <td className='px-4 py-3'>{c.rating === 1 ? '👍' : c.rating === -1 ? '👎' : ''}</td>
                            </tr>
                        ))}
                        {!loading && !data.items.length && (
                            <tr><td colSpan={7} className='px-4 py-10 text-center text-gray-400'>No conversations match these filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className='flex items-center justify-between text-sm text-gray-600'>
                <span>{data.total} conversation{data.total === 1 ? '' : 's'}</span>
                <div className='flex gap-2'>
                    <button className={btnGhost} disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</button>
                    <button className={btnGhost} disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next</button>
                </div>
            </div>
        </div>
    )
}
