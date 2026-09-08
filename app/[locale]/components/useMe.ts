'use client'

import { useEffect, useState } from 'react'

export type Me = { id?: string; name: string | null; email: string; role: string } | null

// Shared client-side auth state. Optimistically restores the last-known user from
// localStorage (so a signed-in visitor's avatar / nav render instantly with no
// flicker), then confirms against /api/me. `undefined` = still loading.
export function useMe(): Me | undefined {
    const [me, setMe] = useState<Me | undefined>(undefined)
    useEffect(() => {
        let stop = false
        try {
            const cached = localStorage.getItem('nit_me')
            if (cached) setMe(JSON.parse(cached) as Me)
        } catch { /* ignore */ }
        fetch('/api/me', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => {
                if (stop) return
                const u = (d.user ?? null) as Me
                setMe(u)
                try { localStorage.setItem('nit_me', JSON.stringify(u)) } catch { /* ignore */ }
            })
            .catch(() => { if (!stop) setMe(null) })
        return () => { stop = true }
    }, [])
    return me
}

/** Update the cached user (after a profile edit) so the navbar reflects it. */
export function setCachedMe(me: Me) {
    try { localStorage.setItem('nit_me', JSON.stringify(me)) } catch { /* ignore */ }
}
