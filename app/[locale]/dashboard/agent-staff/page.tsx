'use client'
// AI staff permissions (FR-C4, US-33): give staff accounts sales, support or
// viewer access to the agent screens. The admin / client roles are unchanged.
import React, { useCallback, useEffect, useState } from 'react'
import { api, btnGhost, btnPrimary, Card, errorText, inputCls, PageHeader } from '../components/agent/ui'

type Staff = { userId: string; name: string | null; email: string; role: 'admin' | 'client'; permissions: string[] }
const PERMS: { key: string; label: string; help: string }[] = [
    { key: 'sales', label: 'Sales', help: 'Sales conversations, leads, price ranges, meetings, usage' },
    { key: 'support', label: 'Support', help: 'Support conversations and tickets' },
    { key: 'viewer', label: 'Viewer', help: 'Usage and analytics only' },
]

function StaffRow({ s, onSaved }: { s: Staff; onSaved: () => void }) {
    const [perms, setPerms] = useState<string[]>(s.permissions)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState('')
    const dirty = perms.slice().sort().join() !== s.permissions.slice().sort().join()
    const save = async () => {
        setBusy(true)
        setErr('')
        const r = await api(`/api/agent/admin/staff/${s.userId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: perms }) })
        setBusy(false)
        if (!r.ok) return setErr(errorText(r))
        onSaved()
    }
    return (
        <tr className='border-t align-top'>
            <td className='px-4 py-3'>{s.name ?? '—'}<div className='text-gray-400'>{s.email}</div></td>
            <td className='px-4 py-3'>
                {s.role === 'admin' ? <span className='text-gray-500'>Admin — has every permission</span> : (
                    <div className='flex flex-wrap gap-4'>
                        {PERMS.map((p) => (
                            <label key={p.key} className='flex items-center gap-1.5' title={p.help}>
                                <input type='checkbox' checked={perms.includes(p.key)} onChange={(e) => setPerms(e.target.checked ? [...perms, p.key] : perms.filter((x) => x !== p.key))} />
                                {p.label}
                            </label>
                        ))}
                    </div>
                )}
                {err && <div role='alert' className='text-red-700 text-xs mt-1'>{err}</div>}
            </td>
            <td className='px-4 py-3'>{s.role !== 'admin' && <button className={btnPrimary} disabled={!dirty || busy} onClick={save}>Save</button>}</td>
        </tr>
    )
}

export default function AgentStaffPage() {
    const [items, setItems] = useState<Staff[]>([])
    const [q, setQ] = useState('')
    const [results, setResults] = useState<Staff[] | null>(null)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const r = await api<{ items: Staff[] }>('/api/agent/admin/staff')
        if (!r.ok) return setError(errorText(r))
        setItems(r.data.items)
    }, [])
    useEffect(() => { load() }, [load])

    const search = async (e: React.FormEvent) => {
        e.preventDefault()
        if (q.trim().length < 3) return setResults([])
        const r = await api<{ items: Staff[] }>(`/api/agent/admin/staff?q=${encodeURIComponent(q.trim())}`)
        if (!r.ok) return setError(errorText(r))
        setResults(r.data.items)
    }
    const refresh = () => { load(); setResults(null); setQ('') }

    const table = (rows: Staff[]) => (
        <div className='overflow-auto bg-white rounded-lg shadow-sm'>
            <table className='w-full text-sm text-left text-gray-600'>
                <thead className='text-xs uppercase bg-gray-50 text-gray-500'><tr><th className='px-4 py-3'>Account</th><th className='px-4 py-3'>AI permissions</th><th /></tr></thead>
                <tbody>{rows.map((s) => <StaffRow key={s.userId} s={s} onSaved={refresh} />)}</tbody>
            </table>
        </div>
    )

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='AI staff permissions' subtitle='صلاحيات فريق المبيعات والدعم على المساعد الذكي' />
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}
            <Card>
                <form onSubmit={search} className='flex gap-2 items-end'>
                    <label className='text-sm flex-1'>Find an account by email (the person must have signed up first)
                        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder='mona@nitg-eg.com' />
                    </label>
                    <button className={btnGhost}>Search</button>
                </form>
            </Card>
            {results && (results.length ? table(results) : <p className='text-sm text-gray-500'>No account matches (type at least 3 characters).</p>)}
            <h5 className='font-semibold'>Current staff</h5>
            {items.length ? table(items) : <p className='text-sm text-gray-500'>No staff permissions granted yet.</p>}
        </div>
    )
}
