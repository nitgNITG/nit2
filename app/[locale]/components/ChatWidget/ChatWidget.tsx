'use client'
// Website chat widget (FR-W1–W10, NFR-11, NFR-13–15). Talks only to /api/agent/**.
// The browser keeps just the conversation id (localStorage, 24 h); access to the
// conversation rides on the HttpOnly agent_session cookie set by the server.
//
// Layout: the launcher sits in the site's right-hand floating column, above the
// share button (desktop) / above the sign-language icon (mobile). The panel opens
// beside the column on desktop and as a full-screen sheet on phones.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
    LuArrowDown, LuArrowRight, LuArrowUpRight, LuBot, LuChevronLeft, LuChevronRight, LuHistory, LuMail, LuRotateCcw,
    LuSendHorizontal, LuThumbsDown, LuThumbsUp, LuUserRound, LuX,
} from 'react-icons/lu'
import { FaWhatsapp } from 'react-icons/fa'
import { widgetAllowedOn } from '@/lib/agent/placement'
import {
    MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport,
} from './MessageScroller'
import RichText from './RichText'
import { createSseParser } from './sse'
import { STRINGS, type Strings } from './strings'

type Locale = 'ar' | 'en'
type Action = { type: 'link'; label: string; url: string }
type Msg = { key: string; id?: string; role: 'visitor' | 'assistant' | 'staff' | 'note' | 'fallback'; text: string; actions?: Action[]; fallback?: Fallback }
type Fallback = { whatsapp: string; contactUrl: string }
type ChatSummary = { id: string; status: string; title: string; lastMessageAt: string }
type History = { scope: 'account' | 'browser' | 'none'; items: ChatSummary[] }
type Config = {
    enabled: boolean; hidden: boolean; greeting: string; suggestions: string[]; whatsapp: string
    proactivePrompt: { id: string; text: string; delaySec: number } | null
}

export const STORE_KEY = 'nit_agent_conv'
const TTL_MS = 24 * 3600_000
const POLL_MS = 4000
const MAX_LEN = 2000

// Right-hand floating column: share sits at bottom-20 (sm) / bottom-24 (md), 56px tall.
const LAUNCHER_POS = 'right-4 bottom-24 sm:right-7 sm:bottom-[148px] md:bottom-[164px]'
const PROMPT_POS = 'right-4 bottom-[172px] sm:right-[100px] sm:bottom-[148px] md:bottom-[164px]'
const PANEL_POS = 'inset-0 sm:inset-auto sm:right-[100px] sm:bottom-5 sm:w-[400px] sm:h-[min(640px,calc(100dvh-7rem))] sm:rounded-2xl sm:border sm:border-gray-200'
const BRAND = 'bg-gradient-to-br from-[#1E7D67] to-[#0B2923]'
// Above the site's fixed header (z 99999) and the Isharat sign-language button
// (z 1e9): on phones the panel is a full-screen sheet and must cover both.
const PANEL_Z = 'z-[2147483000]'

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

export default function ChatWidget({ locale, pathname }: { locale: Locale; pathname: string }) {
    const t = STRINGS[locale]
    const [cfg, setCfg] = useState<Config | null>(null)
    const [open, setOpen] = useState(false)
    const [messages, setMessages] = useState<Msg[]>([])
    const [pending, setPending] = useState<string | null>(null)
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState('open')
    const [convId, setConvId] = useState<string | null>(null)
    const [prompt, setPrompt] = useState<string | null>(null)
    const [rating, setRating] = useState<0 | 1 | -1>(0)
    const [ratingDone, setRatingDone] = useState(false)
    const [comment, setComment] = useState('')
    const [view, setView] = useState<'chat' | 'history'>('chat')
    const [history, setHistory] = useState<History | null>(null)
    const seen = useRef(new Set<string>())
    const lastId = useRef<string | null>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const launcherRef = useRef<HTMLButtonElement>(null)
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

    // Focus the composer on open; on phones the panel is a full-screen sheet, so
    // the page behind must not scroll.
    useEffect(() => {
        if (!open) return
        inputRef.current?.focus()
        const phone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches
        if (!phone) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [open])

    // Grow the composer with its text (up to ~5 lines).
    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    }, [input])

    const close = () => { setOpen(false); launcherRef.current?.focus() }
    const note = (text: string) => setMessages((m) => [...m, { key: key(), role: 'note', text }])
    // The 'not available' card is a timeline entry, so it stays where it happened in the chat.
    const showFallback = (f: Fallback) => setMessages((m) => [...m, { key: key(), role: 'fallback', text: '', fallback: f }])

    const send = useCallback(async (raw: string, retried = false): Promise<void> => {
        const text = raw.trim()
        if (!text || sending) return
        if (text.length > MAX_LEN) return note(t.tooLong)
        if (!retried) setMessages((m) => [...m, { key: key(), role: 'visitor', text }])
        setInput('')
        setPrompt(null)
        setSending(true)
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
                if (res.status === 503) return showFallback(body.fallback ?? { whatsapp: waLink(cfg?.whatsapp ?? ''), contactUrl: `/${locale}/contact` })
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
                        showFallback(ev.data.fallback)
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
        if (r.ok) {
            setStatus('waiting_human')
            // The server saved this reply too: mark its id as seen so the history poll doesn't add it again.
            if (body.messageId) { seen.current.add(body.messageId); lastId.current = body.messageId }
            setMessages((m) => [...m, { key: key(), id: body.messageId, role: 'assistant', text: body.nextReply }])
        }
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
        setView('chat')
    }

    // Previous chats: the signed-in account's, else this browser's.
    const openHistory = async () => {
        setView('history')
        setHistory(null)
        try {
            const r = await fetch('/api/agent/conversations', { credentials: 'same-origin' })
            setHistory(r.ok ? await r.json() : { scope: 'none', items: [] })
        } catch { setHistory({ scope: 'none', items: [] }) }
    }
    const openConversation = async (id: string) => {
        if (id === convId) return setView('chat')
        try {
            const h = await fetch(`/api/agent/conversations/${id}`, { credentials: 'same-origin' })
            if (!h.ok) return
            const data = await h.json()
            newChat()
            setConvId(id)
            setStatus(data.status)
            if (data.status !== 'closed') storage.set(id) // an ended chat is read-only: the next message starts a new one
            addMessages(data.messages, true)
        } catch { /* stay on the list */ }
    }

    if (!allowed || !cfg || cfg.hidden) return null
    const dir = locale === 'ar' ? 'rtl' : 'ltr'

    // Agent off or out of budget → the WhatsApp button instead (FR-W8).
    if (!cfg.enabled) {
        const href = waLink(cfg.whatsapp)
        if (!href) return null
        return (
            <a href={href} target='_blank' rel='noopener noreferrer' aria-label={t.chatWhatsapp}
                className={clsx('fixed z-[1000] flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-300', LAUNCHER_POS)}>
                <FaWhatsapp aria-hidden className='size-7' />
            </a>
        )
    }

    const hasAssistant = messages.some((m) => m.role === 'assistant')
    const statusLine = status === 'waiting_human' ? t.waiting : status === 'human' ? t.withPerson : t.online

    return (
        <>
            {!open && prompt && (
                <div role='status' dir={dir} lang={locale}
                    className={clsx('fixed z-[1000] w-[min(280px,calc(100vw-6rem))] rounded-2xl border border-gray-200 bg-white p-3 text-start text-sm text-gray-800 shadow-xl', PROMPT_POS)}>
                    <button className='block text-start leading-relaxed' onClick={() => { setOpen(true); setPrompt(null) }}>{prompt}</button>
                    <button className='mt-2 text-xs text-gray-500 underline' onClick={() => setPrompt(null)}>{t.promptClose}</button>
                </div>
            )}

            <button
                ref={launcherRef}
                type='button'
                aria-label={open ? t.close : t.open}
                aria-expanded={open}
                onClick={() => (open ? close() : setOpen(true))}
                className={clsx(
                    'group fixed z-[1000] flex size-14 items-center justify-center rounded-full text-white shadow-lg ring-white/40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300',
                    BRAND, LAUNCHER_POS, open && 'max-sm:hidden',
                )}
            >
                {open ? <LuX aria-hidden className='size-6' /> : <LuBot aria-hidden className='size-7' />}
                {!open && (
                    <span aria-hidden data-testid='ai-badge'
                        className='absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-1.5 text-[10px] font-bold leading-4 tracking-wide text-[#1E7D67] shadow ring-1 ring-[#1E7D67]/30'>
                        AI
                    </span>
                )}
                {!open && !prompt && (
                    <span aria-hidden dir={dir} lang={locale}
                        className='pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity max-sm:hidden group-hover:opacity-100 group-focus-visible:opacity-100'>
                        {t.launcherHint}
                    </span>
                )}
                {!open && prompt && <span aria-hidden className='absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white bg-red-500' />}
            </button>

            {open && (
                <div
                    role='dialog'
                    aria-label={t.title}
                    dir={dir}
                    lang={locale}
                    onKeyDown={(e) => { if (e.key === 'Escape') close() }}
                    className={clsx('fixed flex flex-col overflow-hidden bg-white text-start shadow-2xl', PANEL_Z, PANEL_POS)}
                >
                    {/* Header */}
                    <div className={clsx('flex items-center gap-3 px-4 py-3 text-white pt-[max(0.75rem,env(safe-area-inset-top))]', BRAND)}>
                        <div className='relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15'>
                            <LuBot aria-hidden className='size-5' />
                            <span aria-hidden className='absolute bottom-0 end-0 size-2.5 rounded-full border-2 border-[#0B2923] bg-emerald-400' />
                        </div>
                        <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-2'>
                                <span className='truncate font-semibold'>{t.title}</span>
                                <span className='rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'>{t.aiBadge}</span>
                            </div>
                            <div className='truncate text-xs text-white/80'>{statusLine}</div>
                        </div>
                        <button type='button' aria-label={view === 'history' ? t.back : t.history} title={view === 'history' ? t.back : t.history} aria-pressed={view === 'history'}
                            onClick={() => (view === 'history' ? setView('chat') : openHistory())}
                            className='rounded-full p-2 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white'>
                            <LuHistory aria-hidden className='size-4' />
                        </button>
                        {messages.length > 0 && (
                            <button type='button' aria-label={t.newChat} title={t.newChat} onClick={newChat} className='rounded-full p-2 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white'>
                                <LuRotateCcw aria-hidden className='size-4' />
                            </button>
                        )}
                        <button type='button' aria-label={t.close} onClick={close} className='rounded-full p-2 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white'>
                            <LuX aria-hidden className='size-5' />
                        </button>
                    </div>
                    <p className='border-b border-gray-100 bg-emerald-50/60 px-4 py-1.5 text-[11px] leading-snug text-emerald-900'>{t.aiNotice}</p>

                    {view === 'history' && (
                        <HistoryList history={history} t={t} locale={locale} current={convId} onOpen={openConversation} onBack={() => setView('chat')} />
                    )}

                    {/* Transcript */}
                    {view === 'chat' && (<>
                        <MessageScrollerProvider>
                            <MessageScroller>
                                <MessageScrollerViewport aria-live='polite' className='bg-gray-50 px-3 py-4'>
                                    <MessageScrollerContent>
                                        <AssistantBubble text={cfg.greeting} />
                                        {messages.length === 0 && (
                                            <div className='flex flex-wrap gap-2 ps-9'>
                                                {cfg.suggestions.map((s) => (
                                                    <button key={s} onClick={() => send(s)}
                                                        className='rounded-full border border-emerald-700/40 bg-white px-3 py-1.5 text-xs text-emerald-900 shadow-sm transition-colors hover:border-emerald-700 hover:bg-emerald-50'>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {messages.map((m) => (
                                            <MessageScrollerItem key={m.key} scrollAnchor={m.role === 'visitor'}>
                                                <Bubble m={m} t={t} />
                                            </MessageScrollerItem>
                                        ))}
                                        {pending !== null && (
                                            <MessageScrollerItem>
                                                {pending ? <AssistantBubble text={pending} /> : <Typing label={t.typing} />}
                                            </MessageScrollerItem>
                                        )}
                                        {hasAssistant && !ratingDone && (
                                            <div className='flex flex-wrap items-center gap-2 pt-1 text-xs text-gray-500'>
                                                <span>{t.rateQ}</span>
                                                <button aria-label={t.rateUp} aria-pressed={rating === 1} onClick={() => rate(1, false)}
                                                    className={clsx('rounded-full p-1.5 transition-colors hover:bg-gray-200', rating === 1 && 'bg-emerald-100 text-emerald-700')}>
                                                    <LuThumbsUp aria-hidden className='size-4' />
                                                </button>
                                                <button aria-label={t.rateDown} aria-pressed={rating === -1} onClick={() => rate(-1, false)}
                                                    className={clsx('rounded-full p-1.5 transition-colors hover:bg-gray-200', rating === -1 && 'bg-red-100 text-red-700')}>
                                                    <LuThumbsDown aria-hidden className='size-4' />
                                                </button>
                                                {rating !== 0 && (
                                                    <form className='flex w-full gap-1.5' onSubmit={(e) => { e.preventDefault(); rate(rating as 1 | -1, true) }}>
                                                        <input aria-label={t.rateComment} placeholder={t.rateComment} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
                                                            className='min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-base sm:text-xs' />
                                                        <button className='rounded-full bg-gray-200 px-3 text-xs hover:bg-gray-300'>{t.send}</button>
                                                    </form>
                                                )}
                                            </div>
                                        )}
                                        {ratingDone && <div className='pt-1 text-xs text-gray-500'>{t.rateThanks}</div>}
                                    </MessageScrollerContent>
                                </MessageScrollerViewport>
                                <MessageScrollerButton label={t.latest}><LuArrowDown aria-hidden className='size-4' /></MessageScrollerButton>
                            </MessageScroller>
                        </MessageScrollerProvider>

                        {/* Composer */}
                        <div className='border-t border-gray-100 bg-white px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
                            {status === 'closed' && <p role='status' className='mb-2 text-xs text-gray-500'>{t.closedNote}</p>}
                            {status === 'open' && (
                                <button onClick={askHuman} className='mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50'>
                                    <LuUserRound aria-hidden className='size-3.5' />{t.human}
                                </button>
                            )}
                            <form className='flex items-end gap-2' onSubmit={(e) => { e.preventDefault(); send(input) }}>
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
                                    className='max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-base leading-6 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 sm:text-sm'
                                />
                                <button aria-label={t.send} disabled={sending || !input.trim()}
                                    className={clsx('flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow transition-opacity disabled:opacity-40', BRAND)}>
                                    <LuSendHorizontal aria-hidden className='size-5 rtl:-scale-x-100' />
                                </button>
                            </form>
                        </div>
                    </>)}
                </div>
            )}
        </>
    )
}

function HistoryList({ history, t, locale, current, onOpen, onBack }: {
    history: History | null; t: Strings; locale: Locale; current: string | null; onOpen: (id: string) => void; onBack: () => void
}) {
    const Back = locale === 'ar' ? LuChevronRight : LuChevronLeft
    const label = (s: string) => (s === 'closed' ? t.stClosed : s === 'waiting_human' ? t.stWaiting : s === 'human' ? t.stHuman : t.stOpen)
    const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    return (
        <div className='flex min-h-0 flex-1 flex-col bg-gray-50'>
            <div className='flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-2'>
                <button type='button' onClick={onBack} className='inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50'>
                    <Back aria-hidden className='size-4' />{t.back}
                </button>
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto p-3'>
                <h3 className='text-sm font-semibold text-gray-800'>{t.history}</h3>
                {history && history.scope !== 'none' && (
                    <p className='mb-3 text-xs text-gray-500'>{history.scope === 'account' ? t.historyAccount : t.historyBrowser}</p>
                )}
                {!history && <p className='py-6 text-center text-sm text-gray-400'>{t.historyLoading}</p>}
                {history && !history.items.length && <p className='py-6 text-center text-sm text-gray-400'>{t.historyEmpty}</p>}
                <ul className='space-y-2'>
                    {history?.items.map((c) => (
                        <li key={c.id}>
                            <button type='button' onClick={() => onOpen(c.id)} aria-current={c.id === current ? 'true' : undefined}
                                className={clsx('w-full rounded-xl border bg-white px-3 py-2.5 text-start shadow-sm transition-colors hover:border-emerald-600',
                                    c.id === current ? 'border-emerald-600' : 'border-gray-200')}>
                                <div className='truncate text-sm font-medium text-gray-800' dir='auto'>{c.title || t.untitled}</div>
                                <div className='mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-500'>
                                    <span>{fmt.format(new Date(c.lastMessageAt))}</span>
                                    <span className={clsx('rounded-full px-2 py-0.5', c.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-800')}>{label(c.status)}</span>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}

function Avatar({ staff = false }: { staff?: boolean }) {
    return (
        <div aria-hidden className={clsx('flex size-7 shrink-0 items-center justify-center rounded-full text-white', staff ? 'bg-purple-600' : BRAND)}>
            {staff ? <LuUserRound className='size-4' /> : <LuBot className='size-4' />}
        </div>
    )
}

function AssistantBubble({ text, actions }: { text: string; actions?: Action[] }) {
    return (
        <div className='flex items-end gap-2'>
            <Avatar />
            <div className='max-w-[85%] rounded-2xl rounded-es-md border border-gray-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm' dir='auto'>
                <RichText text={text} />
                <Actions actions={actions} />
            </div>
        </div>
    )
}

function Actions({ actions }: { actions?: Action[] }) {
    // Server-built buttons only: internal paths, or https links from settings (brochures, booking).
    const safe = (actions ?? []).filter((a) => /^\/(?!\/)/.test(a.url) || a.url.startsWith('https://'))
    if (!safe.length) return null
    return (
        <div className='mt-2.5 flex flex-wrap gap-2'>
            {safe.map((a) => {
                const external = a.url.startsWith('https://')
                return (
                    <a key={a.url} href={a.url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className='inline-flex items-center gap-1 rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100'>
                        {a.label}
                        {external ? <LuArrowUpRight aria-hidden className='size-3.5' /> : <LuArrowRight aria-hidden className='size-3.5 rtl:-scale-x-100' />}
                    </a>
                )
            })}
        </div>
    )
}

function Bubble({ m, t }: { m: Msg; t: Strings }) {
    if (m.role === 'note') {
        return <div className='mx-auto w-fit max-w-[90%] rounded-full bg-gray-200/70 px-3 py-1 text-center text-xs text-gray-600'>{m.text}</div>
    }
    if (m.role === 'fallback' && m.fallback) return <FallbackCard f={m.fallback} t={t} />
    if (m.role === 'assistant') return <AssistantBubble text={m.text} actions={m.actions} />
    if (m.role === 'staff') {
        return (
            <div className='flex items-end gap-2'>
                <Avatar staff />
                <div className='max-w-[85%] rounded-2xl rounded-es-md border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-800' dir='auto'>
                    <div className='mb-0.5 text-[10px] font-semibold text-purple-700'>{t.team}</div>
                    <span className='whitespace-pre-wrap'>{m.text}</span>
                </div>
            </div>
        )
    }
    return (
        <div className='flex justify-end'>
            <div className={clsx('max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-md px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm', BRAND)} dir='auto'>
                {m.text}
            </div>
        </div>
    )
}

function FallbackCard({ f, t }: { f: Fallback; t: Strings }) {
    return (
        <div role='alert' className='rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-gray-800'>
            {t.fallback}
            <div className='mt-2 flex flex-wrap gap-2'>
                {f.whatsapp && (
                    <a className='inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white' href={f.whatsapp} target='_blank' rel='noopener noreferrer'>
                        <FaWhatsapp aria-hidden className='size-3.5' />{t.whatsapp}
                    </a>
                )}
                <a className='inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs' href={f.contactUrl}>
                    <LuMail aria-hidden className='size-3.5' />{t.contactForm}
                </a>
            </div>
        </div>
    )
}

function Typing({ label }: { label: string }) {
    return (
        <div className='flex items-end gap-2'>
            <Avatar />
            <div role='status' aria-label={label} className='flex gap-1 rounded-2xl rounded-es-md border border-gray-200 bg-white px-4 py-3 shadow-sm'>
                {[0, 150, 300].map((d) => <span key={d} className='size-1.5 animate-bounce rounded-full bg-gray-400' style={{ animationDelay: `${d}ms` }} />)}
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
