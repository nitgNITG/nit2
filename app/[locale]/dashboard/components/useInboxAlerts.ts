'use client'
// Polls the AI Inbox summary for the sidebar badge. With handoff alerts on (a
// per-browser choice), a conversation newly waiting for a person plays a short
// chime and shows a desktop notification that opens it.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'

type Summary = { waiting: number; mine: number; waitingItems: { id: string; mode: string; since: string }[] }

export const ALERTS_KEY = 'nit:handoffAlerts'
const POLL_MS = 20_000

function chime() {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctx()
        const t = ctx.currentTime
        const notes = [880, 1320]
        notes.forEach((f, i) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.frequency.value = f
            gain.gain.setValueAtTime(0.0001, t + i * 0.18)
            gain.gain.exponentialRampToValueAtTime(0.2, t + i * 0.18 + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.3)
            osc.connect(gain).connect(ctx.destination)
            osc.start(t + i * 0.18)
            osc.stop(t + i * 0.18 + 0.32)
        })
        setTimeout(() => ctx.close(), 1000)
    } catch { /* no audio (autoplay policy before any click) — the badge still shows */ }
}

const readPref = () => { try { return localStorage.getItem(ALERTS_KEY) === '1' } catch { return false } }
const writePref = (on: boolean) => { try { localStorage.setItem(ALERTS_KEY, on ? '1' : '0') } catch { /* private mode */ } }

export function useInboxAlerts(enabled: boolean) {
    const locale = useLocale()
    const [summary, setSummary] = useState<Summary>({ waiting: 0, mine: 0, waitingItems: [] })
    const [desktop, setDesktop] = useState(false)
    const [blocked, setBlocked] = useState(false)
    const [supported, setSupported] = useState(false)
    const seen = useRef<Set<string> | null>(null) // null until the first poll: nothing alerts on page load
    const desktopRef = useRef(false)

    useEffect(() => {
        const ok = typeof window !== 'undefined' && 'Notification' in window
        setSupported(ok)
        const on = ok && readPref() && Notification.permission === 'granted'
        setDesktop(on)
        desktopRef.current = on
        setBlocked(ok && Notification.permission === 'denied')
    }, [])

    const alertNew = useCallback((items: Summary['waitingItems']) => {
        if (!desktopRef.current) return
        chime()
        for (const it of items.slice(0, 3)) {
            try {
                const n = new Notification('A conversation needs a person', {
                    body: `${it.mode === 'support' ? 'Support' : 'Sales'} · handed over by the AI assistant`,
                    tag: `handoff-${it.id}`,
                })
                n.onclick = () => { window.focus(); window.location.href = `/${locale}/dashboard/conversations/${it.id}`; n.close() }
            } catch { /* some mobile browsers only allow notifications from a service worker */ }
        }
    }, [locale])

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        const poll = async () => {
            try {
                const res = await fetch('/api/agent/admin/inbox/summary', { cache: 'no-store' })
                if (!res.ok || cancelled) return
                const s: Summary = await res.json()
                setSummary(s)
                const ids = s.waitingItems.map((i) => i.id)
                if (seen.current) {
                    const fresh = s.waitingItems.filter((i) => !seen.current!.has(i.id))
                    if (fresh.length) alertNew(fresh)
                }
                seen.current = new Set(ids)
            } catch { /* offline — try again next tick */ }
        }
        poll()
        const timer = setInterval(poll, POLL_MS)
        const onFocus = () => poll()
        window.addEventListener('focus', onFocus)
        return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', onFocus) }
    }, [enabled, alertNew])

    const toggleDesktop = useCallback(async () => {
        if (!('Notification' in window)) return
        if (desktopRef.current) {
            desktopRef.current = false
            setDesktop(false)
            return writePref(false)
        }
        const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
        setBlocked(perm === 'denied')
        const on = perm === 'granted'
        desktopRef.current = on
        setDesktop(on)
        writePref(on)
        if (on) chime() // confirms sound works (and unlocks audio after this click)
    }, [])

    return { ...summary, desktop, blocked, supported, toggleDesktop }
}
