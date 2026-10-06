'use client'
// AI Settings → Abuse protection: the public chat's rate limits (editable) and
// today's numbers — requests blocked per rule, the IPs blocked most, the busiest visitors.
import React, { useEffect, useState } from 'react'
import { api, btnGhost, errorText, inputCls } from './ui'

type Stats = {
    since: string
    blocked: Record<'ip_messages' | 'ip_new_conversations' | 'visitor_daily', number>
    topBlockedIps: { ip: string; count: number }[]
    topVisitors: { visitor: string; kind: 'user' | 'guest' | 'ip'; messages: number }[]
}

type Field = { path: string; label: string; min: number; max: number; help: string }
const FIELDS: Field[] = [
    {
        path: 'abuse.ipMessagesPerWindow', label: 'Messages per IP', min: 1, max: 1000,
        help: 'Stops scripts flooding the chat from one address. Risk if too low: an office or mobile network shares one IP, so many real people can hit it together.',
    },
    { path: 'abuse.ipWindowMinutes', label: '…within (minutes)', min: 1, max: 1440, help: 'The window the IP message count above applies to.' },
    {
        path: 'abuse.ipNewConversationsPerHour', label: 'New chats per IP per hour', min: 1, max: 500,
        help: 'Stops someone clearing cookies to get a fresh chat (and fresh limits) again and again.',
    },
    {
        path: 'abuse.visitorMessagesPerDay', label: 'Messages per visitor per day', min: 1, max: 5000,
        help: 'Per signed-in account, else per guest browser session — fair to shared IPs. Caps what one person can cost in a day.',
    },
    {
        path: 'limits.maxConversationMessages', label: 'Max messages per conversation', min: 2, max: 1000,
        help: 'After this the visitor is asked to start a new chat or talk to the team. Keeps long chats from getting slow and expensive.',
    },
]

const RULE_LABEL: Record<keyof Stats['blocked'], string> = {
    ip_messages: 'IP message limit', ip_new_conversations: 'IP new-chat limit', visitor_daily: 'Visitor daily limit',
}
const KIND = { user: 'Signed in', guest: 'Guest', ip: 'IP' } as const

export default function AbuseSection({ cfg, num }: { cfg: any; num: (path: string) => (e: React.ChangeEvent<HTMLInputElement>) => void }) {
    const [stats, setStats] = useState<Stats | null>(null)
    const [error, setError] = useState('')
    const load = () => api<Stats>('/api/agent/admin/abuse').then((r) => (r.ok ? (setStats(r.data), setError('')) : setError(errorText(r))))
    useEffect(() => { load() }, [])

    const get = (path: string) => path.split('.').reduce((o, k) => o?.[k], cfg)
    const perDay = cfg.abuse.visitorMessagesPerDay as number

    return (
        <div className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {FIELDS.map((f) => (
                    <label key={f.path} className='block text-sm'>
                        <span className='font-medium text-gray-700'>{f.label}</span>
                        <input type='number' min={f.min} max={f.max} className={inputCls} value={get(f.path)} onChange={num(f.path)} />
                        <span className='mt-1 block text-xs text-gray-500'>{f.help}</span>
                    </label>
                ))}
            </div>
            <p className='text-xs text-gray-500'>
                Blocked visitors see &quot;too many messages, try again shortly&quot;. IPs are stored hashed only. Every reply is also capped by the daily budget above.
            </p>

            <div className='rounded-lg border border-gray-200 p-3 space-y-3'>
                <div className='flex items-center justify-between gap-2'>
                    <h6 className='text-sm font-semibold text-gray-800'>Today (since {stats ? new Date(stats.since).toISOString().slice(0, 16).replace('T', ' ') : '…'} UTC)</h6>
                    <button type='button' className={btnGhost} onClick={load}>Refresh</button>
                </div>
                {error && <p className='text-xs text-red-600'>{error}</p>}
                {stats && (
                    <>
                        <div className='grid grid-cols-3 gap-2'>
                            {(Object.keys(RULE_LABEL) as (keyof Stats['blocked'])[]).map((k) => (
                                <div key={k} className='rounded bg-gray-50 p-2'>
                                    <div className='text-xs text-gray-500'>Blocked · {RULE_LABEL[k]}</div>
                                    <div className={stats.blocked[k] ? 'text-lg font-semibold text-red-600' : 'text-lg font-semibold'}>{stats.blocked[k]}</div>
                                </div>
                            ))}
                        </div>
                        <div className='grid gap-3 md:grid-cols-2 text-sm'>
                            <div>
                                <div className='mb-1 text-xs font-medium text-gray-500'>Busiest visitors (messages today / limit {perDay})</div>
                                {stats.topVisitors.length ? (
                                    <ul className='divide-y'>
                                        {stats.topVisitors.map((v, i) => (
                                            <li key={i} className='flex justify-between py-1'>
                                                <span dir='auto'>{v.visitor} <span className='text-xs text-gray-400'>{KIND[v.kind]}</span></span>
                                                <span className={v.messages > perDay ? 'font-semibold text-red-600' : ''}>{v.messages}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className='text-xs text-gray-400'>No messages yet today.</p>}
                            </div>
                            <div>
                                <div className='mb-1 text-xs font-medium text-gray-500'>IPs blocked most</div>
                                {stats.topBlockedIps.length ? (
                                    <ul className='divide-y'>
                                        {stats.topBlockedIps.map((b) => <li key={b.ip} className='flex justify-between py-1 font-mono text-xs'><span>{b.ip}</span><span>{b.count}</span></li>)}
                                    </ul>
                                ) : <p className='text-xs text-gray-400'>Nothing blocked today.</p>}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
