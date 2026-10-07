'use client'
// AI Settings → Telegram alerts: the AI assistant's own bot + chat (handoffs,
// HOT leads, tickets, meetings, budget, errors), separate from the SaaS bot.
// The token is stored encrypted and never shown again.
import React, { useEffect, useState } from 'react'
import { api, btnGhost, btnPrimary, errorText, inputCls } from './ui'

type Status = { chatId: string; tokenSet: boolean; usingShared: boolean; sharedConfigured: boolean; encryptionReady: boolean }
type Chat = { id: string; title: string; type: string }

export default function TelegramSection() {
    const [s, setS] = useState<Status | null>(null)
    const [botToken, setBotToken] = useState('')
    const [chatId, setChatId] = useState('')
    const [chats, setChats] = useState<Chat[] | null>(null)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [busy, setBusy] = useState(false)

    const apply = (st: Status) => { setS(st); setChatId(st.chatId); setBotToken('') }
    useEffect(() => { api<Status>('/api/agent/admin/telegram').then((r) => (r.ok ? apply(r.data) : setMsg({ ok: false, text: errorText(r) }))) }, [])

    const run = async <T,>(fn: () => Promise<{ ok: boolean; status: number; data: T }>, done: (d: T) => void) => {
        setBusy(true); setMsg(null)
        const r = await fn()
        setBusy(false)
        if (!r.ok) return setMsg({ ok: false, text: errorText(r) })
        done(r.data)
    }
    const save = () => run(
        () => api<Status>('/api/agent/admin/telegram', { method: 'PUT', body: JSON.stringify({ chatId, ...(botToken ? { botToken } : {}) }) }),
        (d) => { apply(d); setMsg({ ok: true, text: d.usingShared ? 'Saved. Alerts still use the shared bot until both the token and the chat ID are set.' : 'Saved. AI alerts now go to this chat.' }) },
    )
    const find = () => run(
        () => api<{ chats: Chat[] }>('/api/agent/admin/telegram', { method: 'POST', body: JSON.stringify({ action: 'find_chats', botToken }) }),
        (d) => { setChats(d.chats); if (d.chats.length === 1) setChatId(d.chats[0].id) },
    )
    const test = () => run(
        () => api<{ target: 'agent' | 'shared' }>('/api/agent/admin/telegram', { method: 'POST', body: JSON.stringify({ action: 'test' }) }),
        (d) => setMsg({ ok: true, text: d.target === 'agent' ? 'Test sent to the AI alerts chat.' : 'Test sent to the shared (SaaS) bot — set this card to move AI alerts to their own chat.' }),
    )

    if (!s) return <p className='text-sm text-gray-400'>{msg?.text ?? 'Loading…'}</p>

    return (
        <div className='space-y-4'>
            <p className={s.usingShared ? 'text-sm text-amber-700' : 'text-sm text-emerald-700'}>
                {s.usingShared
                    ? `Now: AI alerts go to the shared SaaS bot${s.sharedConfigured ? '' : ' (not configured either — no Telegram alerts)'}.`
                    : `Now: AI alerts go to their own chat (${s.chatId}).`}
            </p>

            <ol className='list-decimal space-y-1 ps-5 text-xs text-gray-600'>
                <li>In Telegram, open <b>@BotFather</b> → <code>/newbot</code> → copy the token it gives you.</li>
                <li>Create a group (e.g. &quot;NIT AI Inbox&quot;), add the new bot to it, and send any message in the group.</li>
                <li>Paste the token below → <b>Find chat ID</b> → pick the group → <b>Save</b> → <b>Send test</b>.</li>
            </ol>

            <div className='grid gap-3 md:grid-cols-2'>
                <label className='text-sm'>Bot token {s.tokenSet && <span className='text-xs text-gray-500'>(saved — leave empty to keep it)</span>}
                    <input type='password' autoComplete='off' className={inputCls} value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={s.tokenSet ? '••••••••' : '123456789:AA…'} />
                </label>
                <label className='text-sm'>Chat ID
                    <input className={inputCls} dir='ltr' value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder='-1001234567890' />
                </label>
            </div>

            {chats && (
                <div className='rounded-lg border border-gray-200 p-3 text-sm'>
                    {chats.length ? (
                        <ul className='space-y-1'>
                            {chats.map((c) => (
                                <li key={c.id}>
                                    <button type='button' onClick={() => setChatId(c.id)} className={`rounded px-2 py-1 hover:bg-gray-100 ${chatId === c.id ? 'bg-emerald-50 text-emerald-800' : ''}`}>
                                        {c.title} <span className='text-xs text-gray-500'>({c.type} · {c.id})</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className='text-gray-500'>No chats yet — add the bot to your group, send a message there, then try again.</p>}
                </div>
            )}

            <div className='flex flex-wrap gap-2'>
                <button type='button' className={btnGhost} disabled={busy || (!botToken && !s.tokenSet)} onClick={find}>Find chat ID</button>
                <button type='button' className={btnPrimary} disabled={busy || !s.encryptionReady} onClick={save}>Save Telegram settings</button>
                <button type='button' className={btnGhost} disabled={busy} onClick={test}>Send test</button>
            </div>
            <p className='text-xs text-gray-500'>Clear both fields and save to send AI alerts back to the shared bot.</p>
            {msg && <p role='status' className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-600'}>{msg.text}</p>}
        </div>
    )
}
