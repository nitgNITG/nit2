'use client'

import React, { useEffect, useState } from 'react'

type State = 'live' | 'preparing' | 'checking'

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
        live: { dot: 'bg-[#00c98e]', text: 'text-[#00FFB2]', label: 'Live' },
        preparing: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', label: 'Preparing' },
        checking: { dot: 'bg-white/30 animate-pulse', text: 'text-white/50', label: 'Checking…' },
    }
    const s = map[state]

    return (
        <span className='inline-flex items-center gap-1.5 text-xs font-bold'>
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className={s.text}>{s.label}</span>
        </span>
    )
}
