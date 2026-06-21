'use client'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

type Variant = 'up' | 'zoom' | 'left' | 'right'

interface ScrollRevealProps {
    children: React.ReactNode
    className?: string
    /** stagger in ms — useful when several reveals share a row */
    delay?: number
    /** entrance direction/style (default: 'up') */
    variant?: Variant
    /** re-animate each time it re-enters the viewport (default: false = one-shot) */
    repeat?: boolean
}

/**
 * Reveal-on-scroll wrapper.
 * - Animates ONLY opacity + transform (GPU-composited, no layout/repaint cost).
 * - Uses IntersectionObserver (no scroll listeners) and disconnects after the
 *   first reveal, so there's no ongoing work while scrolling.
 * - Honors `prefers-reduced-motion` (handled in globals.css) and degrades to
 *   fully-visible without JS (see <noscript> fallback in layout.tsx).
 */
export default function ScrollReveal({
    children,
    className,
    delay = 0,
    variant = 'up',
    repeat = false,
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        // Safety: if IntersectionObserver is unavailable, just show the content.
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true)
            return
        }
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    if (!repeat) io.disconnect()
                } else if (repeat) {
                    setVisible(false)
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [repeat])

    return (
        <div
            ref={ref}
            className={clsx('reveal', `reveal-${variant}`, { 'is-visible': visible }, className)}
            style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        >
            {children}
        </div>
    )
}
