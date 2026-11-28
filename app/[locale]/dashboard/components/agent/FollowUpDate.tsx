'use client'
// "Next follow-up" on a lead (FR-F1): on that day (Cairo time) the AI drafts a
// follow-up in Follow-ups for a person to approve. Used in the AI Inbox lead
// panel and the Contacts popup.
import React, { useState } from 'react'
import { api, btnGhost, errorText } from './ui'

const cairoDay = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(iso)) : '')
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())

export default function FollowUpDate({ contactId, value, onSaved }: { contactId: string; value: string | null | undefined; onSaved?: () => void }) {
    const [day, setDay] = useState(cairoDay(value))
    const [saved, setSaved] = useState(cairoDay(value))
    const [msg, setMsg] = useState('')
    const [busy, setBusy] = useState(false)

    const save = async (next: string) => {
        setBusy(true); setMsg('')
        const r = await api(`/api/agent/admin/leads/${contactId}`, { method: 'PATCH', body: JSON.stringify({ nextFollowUpAt: next || null }) })
        setBusy(false)
        if (!r.ok) return setMsg(errorText(r))
        setDay(next); setSaved(next)
        setMsg(next ? 'Saved — the AI drafts a follow-up that morning.' : 'Cleared.')
        onSaved?.()
    }

    return (
        <div className='space-y-1 text-sm'>
            <label className='flex flex-wrap items-center gap-2'>
                <span className='text-gray-600'>Next follow-up</span>
                <input type='date' min={today()} value={day} onChange={(e) => setDay(e.target.value)}
                    className='rounded border border-gray-300 px-2 py-1 text-sm' />
                <button type='button' className={btnGhost} disabled={busy || day === saved} onClick={() => save(day)}>Save</button>
                {saved && <button type='button' className='text-xs text-gray-500 underline' disabled={busy} onClick={() => save('')}>Clear</button>}
            </label>
            {msg && <p role='status' className='text-xs text-gray-500'>{msg}</p>}
        </div>
    )
}
