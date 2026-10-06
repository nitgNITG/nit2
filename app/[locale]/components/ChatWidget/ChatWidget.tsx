'use client'
// Website chat widget (FR-W1–W10, NFR-11, NFR-13–15). Talks only to /api/agent/**.
// The browser keeps just the conversation id (localStorage, 24 h); access to the
// conversation rides on the HttpOnly agent_session cookie set by the server.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { widgetAllowedOn } from '@/lib/agent/placement'
import { createSseParser } from './sse'
import { STRINGS } from './strings'

type Locale = 'ar' | 'en'
type Action = { type: 'link'; label: string; url: string }
type Msg = { key: string; id?: string; role: 'visitor' | 'assistant' | 'staff' | 'note'; text: string; actions?: Action[] }
type Fallback = { whatsapp: string; contactUrl: string }
type Config = {
    enabled: boolean; hidden: boolean; greeting: string; suggestions: string[]; whatsapp: string
    proactivePrompt: { id: string; text: string; delaySec: number } | null
}

export const STORE_KEY = 'nit_agent_conv'
const TTL_MS = 24 * 3600_000
const POLL_MS = 4000
const MAX_LEN = 2000

const storage = {
    get(): string | null {
        try {
            const raw = localStorage.getItem(STORE_KEY)
            if (!raw) return null
            const v = JSON.parse(raw) as { id: string; at: number }
            if (!v?.id || Date.now() - v.at > TTL_MS) { localStorage.removeItem(STORE_KEY); return null }
            return v.id
        } catch { return null }
    },
    set(id: string) { try { localStorage.setItem(STORE_KEY, JSON.stringify({ id, at: Date.now() })) } catch { /* private mode */ } },
    clear() { try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ } },
}
const session = {
    get(k: string) { try { return sessionStorage.getItem(k) } catch { return null } },
    set(k: string) { try { sessionStorage.setItem(k, '1') } catch { /* ignore */ } },
}

const waLink = (n: string) => (n.replace(/\D/g, '') ? `https://wa.me/${n.replace(/\D/g, '')}` : '')
let seq = 0
const key = () => `m${++seq}`

function ChatIcon() {
    return (
        <svg aria-hidden='true' viewBox='0 0 24 24' className='size-7 fill-none stroke-white' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round'>
            <path d='M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z' />
        </svg>
    )
}

export default function ChatWidget({ locale, pathname }: { locale: Locale; pathname: string }) {
    const t = STRINGS[locale]
    const [cfg, setCfg] = useState<Config | null>(null)
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Msg[]>([])
    const [pending, setPending] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState('open')
    const [fallback, setFallback] = useState<Fallback | null>(null)
    const [convId, setConvId] = useState<string | null>(null)
    const [prompt, setPrompt] = useState<string | null>(null)
    const [rating, setRating] = useState<0 | 1 | -1>(0)
    const [ratingDone, setRatingDone] = useState(false)
    const [comment, setComment] = useState('')
    const seen = useRef(new Set<string>())
    const lastId = useRef<string | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const allowed = widgetAllowedOn(pathname)

    const addMessages = useCallback((rows: { id: string; role: string; content: string }[], includeVisitor: boolean) => {
        const fresh = rows.filter((r) => !seen.current.has(r.id) && (includeVisitor || r.role !== 'visitor'))
        fresh.forEach((r) => seen.current.add(r.id))
        if (rows.length) lastId.current = rows[rows.length - 1].id
        if (fresh.length) setMessages((m) => [...m, ...fresh.map((r) => ({ key: key(), id: r.id, role: r.role as Msg['role'], text: r.content }))])
    }, [])

    // Config (E1) + resume a conversation from this browser (FR-W5).
    useEffect(() => {
        if (!allowed) return
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch(`/api/agent/config?locale=${locale}&page=${encodeURIComponent(pathname)}`, { credentials: 'same-origin' })
                const c = (await res.json()) as Config
                if (cancelled) return
                setCfg(c)
                const id = storage.get()
                if (!c.enabled || !id) return
                const h = await fetch(`/api/agent/conversations/${id}`, { credentials: 'same-origin' })
                if (!h.ok) { storage.clear(); return }
                const data = await h.json()
                if (cancelled) return
                setConvId(id)
                setStatus(data.status)
                addMessages(data.messages, true)
            } catch { /* widget stays closed; nothing to show */ }
        })()
        return () => { cancelled = true }
    }, [allowed, locale, pathname, addMessages])

    // Page-aware prompt, once per session (FR-W10, AC-26.1).
    useEffect(() => {
        const p = cfg?.enabled ? cfg.proactivePrompt : null
        if (!p || open || messages.length) return
        const k = `nit_agent_prompt_${p.id}`
        if (session.get(k)) return
        const timer = setTimeout(() => { session.set(k); setPrompt(p.text) }, p.delaySec * 1000)
        return () => clearTimeout(timer)
    }, [cfg, open, messages.length])

    // While a person handles it, fetch new replies every few seconds (AC-12.1).
    useEffect(() => {
        if (!open || !convId || (status !== 'waiting_human' && status !== 'human')) return
        const timer = setInterval(async () => {
            try {
                const qs = lastId.current ? `?after=${lastId.current}` : ''
                const r = await fetch(`/api/agent/conversations/${convId}${qs}`, { credentials: 'same-origin' })
                if (!r.ok) return
                const data = await r.json()
                setStatus(data.status)
                addMessages(data.messages, false)
            } catch { /* try again next tick */ }
        }, POLL_MS)
        return () => clearInterval(timer)
    }, [open, convId, status, addMessages])

    useEffect(() => {
        listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight })
    }, [messages, pending])

    useEffect(() => {
        if (open) inputRef.current?.focus()
    }, [open])

    const note = (text: string) => setMessages((m) => [...m, { key: key(), role: 'note', text }])

    const send = useCallback(async (raw: string, retried = false): Promise<void> => {
        const text = raw.trim()
        if (!text || sending) return
        if (text.length > MAX_LEN) return note(t.tooLong)
        if (!retried) setMessages((m) => [...m, { key: key(), role: 'visitor', text }])
        setInput('')
        setPrompt(null)
        setSending(true)
        setFallback(null)
        const id = retried ? null : convId
        try {
            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(id ? { conversationId: id } : {}), message: text, locale, page: pathname, utm: utmFromUrl() }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setSending(false)
                if ((res.status === 404 || body.error === 'conversation_closed') && !retried) {
                    storage.clear(); setConvId(null); setStatus('open')
                    return send(text, true) // start over in a new conversation
                }
                if (res.status === 503) return setFallback(body.fallback ?? { whatsapp: waLink(cfg?.whatsapp ?? ''), contactUrl: `/${locale}/contact` })
                if (res.status === 429) return note(t.tooMany)
                if (body.error === 'conversation_busy') return note(t.busy)
                if (res.status === 413) return note(t.tooLong)
                return note(t.error)
            }
            await readStream(res)
        } catch {
            setPending(null)
            note(t.error)
        } finally {
            setSending(false)
        }

        async function readStream(res: Response) {
            const reader = res.body!.getReader()
            const decoder = new TextDecoder()
            const parser = createSseParser()
            let reply = ''
            let actions: Action[] = []
            let handoffText = ''
            setPending('')
            for (;;) {
                const { value, done } = await reader.read()
                if (done) break
                for (const ev of parser.push(decoder.decode(value, { stream: true }))) {
                    if (ev.event === 'meta') {
                        setConvId(ev.data.conversationId)
                        storage.set(ev.data.conversationId)
                        setStatus(ev.data.status)
                    } else if (ev.event === 'delta') {
                        reply += ev.data.text
                        setPending(reply)
                    } else if (ev.event === 'action') {
                        actions = [...actions, ev.data]
                    } else if (ev.event === 'handoff') {
                        setStatus(ev.data.status)
                        handoffText = ev.data.message ?? ''
                    } else if (ev.event === 'done') {
                        setPending(null)
                        if (ev.data.messageId) {
                            seen.current.add(ev.data.messageId)
                            lastId.current = ev.data.messageId
                            const text = reply.trim() || handoffText
                            if (text) setMessages((m) => [...m, { key: key(), id: ev.data.messageId, role: 'assistant', text, actions }])
                        }
                        // messageId null: the reply was discarded (a person took over) — drop it (AC-12.3).
                    } else if (ev.event === 'error') {
                        setPending(null)
                        setFallback(ev.data.fallback)
                    }
                }
            }
            setPending(null)
        }
    }, [sending, convId, locale, pathname, cfg?.whatsapp, t])

    const askHuman = async () => {
        if (!convId) return send(t.human)
        const r = await fetch(`/api/agent/conversations/${convId}/handoff`, { method: 'POST', credentials: 'same-origin' })
        const body = await r.json().catch(() => ({}))
        if (r.ok) { setStatus('waiting_human'); setMessages((m) => [...m, { key: key(), role: 'assistant', text: body.nextReply }]) }
        else if (r.status === 409) setStatus(body.status ?? 'waiting_human')
        else note(t.error)
    }

    const rate = async (value: 1 | -1, withComment: boolean) => {
        setRating(value)
        if (!convId) return
        const r = await fetch(`/api/agent/conversations/${convId}/rating`, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: value, ...(withComment && comment.trim() ? { comment: comment.trim().slice(0, 500) } : {}) }),
        })
        if (r.ok && withComment) setRatingDone(true)
    }

    const newChat = () => {
        storage.clear(); setConvId(null); setMessages([]); setStatus('open'); setRating(0); setRatingDone(false); seen.current.clear(); lastId.current = null
    }

    if (!allowed || !cfg || cfg.hidden) return null
    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    const side = 'left-4 sm:left-5'

    // Agent off or out of budget → the WhatsApp button instead (FR-W8).
    if (!cfg.enabled) {
        const href = waLink(cfg.whatsapp)
        if (!href) return null
        return (
            <a href={href} target='_blank' rel='noopener noreferrer' aria-label={t.chatWhatsapp}
                className={`fixed bottom-5 ${side} z-[1000] size-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300`}>
                <ChatIcon />
            </a>
        )
    }

    const hasAssistant = messages.some((m) => m.role === 'assistant')
    return (
        <div dir={dir} lang={locale} className='text-start'>
            {!open && prompt && (
                <div role='status' className={`fixed bottom-24 ${side} z-[1000] max-w-[260px] bg-white text-gray-800 text-sm rounded-xl shadow-xl border p-3`}>
                    <button className='block text-start' onClick={() => { setOpen(true); setPrompt(null) }}>{prompt}</button>
                    <button className='mt-2 text-xs text-gray-500 underline' onClick={() => setPrompt(null)}>{t.promptClose}</button>
                </div>
            )}
            <button
                type='button'
                aria-label={open ? t.close : t.open}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className={`fixed bottom-5 ${side} z-[1000] size-14 rounded-full bg-gradient-to-l from-[#1E7D67] to-[#0B2923] shadow-lg flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300`}
            >
                {open ? <span aria-hidden='true' className='text-white text-2xl leading-none'>×</span> : <ChatIcon />}
            </button>

            {open && (
                <div
                    role='dialog'
                    aria-label={t.title}
                    onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                    className={`fixed bottom-24 ${side} z-[1000] w-[calc(100vw-2rem)] sm:w-[380px] h-[min(600px,calc(100svh-8rem))] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden`}
                >
                    <div className='bg-gradient-to-l from-[#1E7D67] to-[#0B2923] text-white px-4 py-3'>
                        <div className='flex items-center justify-between gap-2'>
                            <div className='font-semibold'>{t.title}</div>
                            <div className='flex gap-2 items-center'>
                                {messages.length > 0 && <button className='text-xs underline opacity-90' onClick={newChat}>{t.newChat}</button>}
                                <button aria-label={t.close} className='text-xl leading-none px-1' onClick={() => setOpen(false)}>×</button>
                            </div>
                        </div>
                        <p className='text-[11px] opacity-90 mt-0.5'>{t.aiNotice}</p>
                    </div>

                    <div ref={listRef} aria-live='polite' className='flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50'>
                        <div className='bg-white border rounded-xl px-3 py-2 text-sm text-gray-800 max-w-[85%] whitespace-pre-wrap'>{cfg.greeting}</div>
                        {messages.length === 0 && (
                            <div className='flex flex-wrap gap-2 pt-1'>
                                {cfg.suggestions.map((s) => (
                                    <button key={s} onClick={() => send(s)} className='text-xs border border-emerald-700 text-emerald-800 rounded-full px-3 py-1 hover:bg-emerald-50'>{s}</button>
                                ))}
                            </div>
                        )}
                        {messages.map((m) => <Bubble key={m.key} m={m} team={t.team} />)}
                        {pending !== null && (pending
                            ? <Bubble m={{ key: 'pending', role: 'assistant', text: pending }} team={t.team} />
                            : <div className='text-xs text-gray-500'>{t.typing}</div>)}
                        {status === 'waiting_human' && <div className='text-xs text-center text-orange-700'>{t.waiting}</div>}
                        {status === 'human' && <div className='text-xs text-center text-purple-700'>{t.withPerson}</div>}
                        {fallback && (
                            <div role='alert' className='bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-gray-800'>
                                {t.fallback}
                                <div className='flex gap-2 mt-2'>
                                    {fallback.whatsapp && <a className='px-3 py-1 rounded bg-[#25D366] text-white text-xs' href={fallback.whatsapp} target='_blank' rel='noopener noreferrer'>{t.whatsapp}</a>}
                                    <a className='px-3 py-1 rounded border text-xs' href={fallback.contactUrl}>{t.contactForm}</a>
                                </div>
                            </div>
                        )}
                        {hasAssistant && !ratingDone && (
                            <div className='pt-2 text-xs text-gray-600'>
                                <span>{t.rateQ}</span>{' '}
                                <button aria-label={t.rateUp} aria-pressed={rating === 1} onClick={() => rate(1, false)} className={rating === 1 ? 'opacity-100' : 'opacity-60'}>👍</button>{' '}
                                <button aria-label={t.rateDown} aria-pressed={rating === -1} onClick={() => rate(-1, false)} className={rating === -1 ? 'opacity-100' : 'opacity-60'}>👎</button>
                                {rating !== 0 && (
                                    <form className='flex gap-1 mt-1' onSubmit={(e) => { e.preventDefault(); rate(rating as 1 | -1, true) }}>
                                        <input aria-label={t.rateComment} placeholder={t.rateComment} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} className='flex-1 border rounded px-2 py-1' />
                                        <button className='px-2 rounded bg-gray-200'>{t.send}</button>
                                    </form>
                                )}
                            </div>
                        )}
                        {ratingDone && <div className='pt-2 text-xs text-gray-500'>{t.rateThanks}</div>}
                    </div>

                    <div className='border-t p-2 space-y-2 bg-white'>
                        {status === 'open' && (
                            <button onClick={askHuman} className='text-xs text-emerald-800 underline'>{t.human}</button>
                        )}
                        <form className='flex gap-2 items-end' onSubmit={(e) => { e.preventDefault(); send(input) }}>
                            <textarea
                                ref={inputRef}
                                aria-label={t.placeholder}
                                placeholder={t.placeholder}
                                dir='auto'
                                rows={1}
                                maxLength={MAX_LEN}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                                className='flex-1 resize-none border rounded-lg px-3 py-2 text-sm max-h-28 focus:outline-none focus:ring-2 focus:ring-emerald-600'
                            />
                            <button disabled={sending || !input.trim()} className='px-3 py-2 rounded-lg bg-[#1E7D67] text-white text-sm disabled:opacity-50'>{t.send}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function Bubble({ m, team }: { m: Msg; team: string }) {
    if (m.role === 'note') return <div className='text-xs text-center text-gray-500'>{m.text}</div>
    const visitor = m.role === 'visitor'
    return (
        <div className={`flex ${visitor ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${visitor ? 'bg-[#1E7D67] text-white' : m.role === 'staff' ? 'bg-purple-50 border border-purple-200 text-gray-800' : 'bg-white border text-gray-800'}`} dir='auto'>
                {m.role === 'staff' && <div className='text-[10px] text-purple-700 mb-0.5'>{team}</div>}
                {m.text}
                {!!m.actions?.length && (
                    <div className='flex flex-wrap gap-2 mt-2'>
                        {/* Server-built buttons only: internal paths, or https links from settings (brochures, booking). */}
                        {m.actions.filter((a) => /^\/(?!\/)/.test(a.url) || a.url.startsWith('https://')).map((a) => {
                            const external = a.url.startsWith('https://')
                            return (
                                <a key={a.url} href={a.url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    className='text-xs px-3 py-1 rounded-full bg-emerald-50 border border-emerald-600 text-emerald-800 hover:bg-emerald-100'>{a.label}</a>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function utmFromUrl() {
    try {
        const q = new URLSearchParams(window.location.search)
        const utm = { source: q.get('utm_source') ?? undefined, medium: q.get('utm_medium') ?? undefined, campaign: q.get('utm_campaign') ?? undefined }
        return utm.source || utm.medium || utm.campaign
            ? { source: utm.source?.slice(0, 100), medium: utm.medium?.slice(0, 100), campaign: utm.campaign?.slice(0, 100) }
            : undefined
    } catch { return undefined }
}
