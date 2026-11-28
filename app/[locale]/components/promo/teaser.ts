'use client'
import { useEffect, useState } from 'react'

// Only one muted teaser plays at a time on the whole page (spec §6–7).
let playing: HTMLVideoElement | null = null

export function playExclusive(video: HTMLVideoElement): Promise<void> {
    if (playing && playing !== video) playing.pause()
    playing = video
    return video.play().catch(() => { /* autoplay refused — the poster stays */ })
}

/** Pause whichever teaser is playing (the lightbox is opening); returns a resume function. */
export function suspendTeaser(): () => void {
    const video = playing
    if (!video || video.paused) return () => {}
    video.pause()
    return () => { if (playing === video) video.play().catch(() => {}) }
}

export function releaseTeaser(video: HTMLVideoElement | null) {
    if (!video) return
    video.pause()
    if (playing === video) playing = null
}

/** Pure decision, exported for tests: reduced motion or Data Saver → poster only. */
export function autoplayAllowed(reducedMotion: boolean, saveData: boolean): boolean {
    return !reducedMotion && !saveData
}

/** False on the server and until mounted, so SSR always renders the poster. */
export function useTeaserAllowed(): boolean {
    const [allowed, setAllowed] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
        const update = () => setAllowed(autoplayAllowed(mq.matches, saveData))
        update()
        mq.addEventListener?.('change', update)
        return () => mq.removeEventListener?.('change', update)
    }, [])
    return allowed
}
