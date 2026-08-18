'use client'

import React, { useEffect, useState } from 'react'

type State = 'live' | 'preparing' | 'checking'

// Pings the academy once on load so the admin sees real status, not just the
// last-stored value. (The status route also persists "live" when it detects it.)
export default function AdminAcademyStatus({ slug, initial }: { slug: string; initial: string }) {
    const [state, setState] = useState<State>(initial === 'live' ? 'live' : 'checking')

    useEffect(() => {
        if (state === 'live') return
        let stopped = false
        fetch(`/api/academies/${slug}/status`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => { if (!stopped) setState(d.live ? 'live' : 'preparing') })
            .catch(() => { if (!stopped) setState('preparing') })
        return () => { stopped = true }
    }, [slug, state])

    const map: Record<State, { dot: string; text: string; label: string }> = {
        live: { dot: 'bg-green-500', text: 'text-green-700', label: 'Live' },
        preparing: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700', label: 'Preparing' },
        checking: { dot: 'bg-gray-300 animate-pulse', text: 'text-gray-500', label: 'Checking…' },
    }
    const s = map[state]

    return (
        <span className='inline-flex items-center gap-1.5 text-xs font-semibold'>
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className={s.text}>{s.label}</span>
        </span>
    )
}
