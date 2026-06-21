'use client'
import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
    /** target value to count up to */
    end: number
    /** text shown before the number, e.g. "$" */
    prefix?: string
    /** text shown after the number, e.g. "+" or "%" */
    suffix?: string
    /** animation length in ms (default 1800) */
    duration?: number
    /** decimal places to keep (default 0) */
    decimals?: number
    className?: string
}

/**
 * Counts from 0 up to `end` once the element scrolls into view.
 * - Uses requestAnimationFrame with easeOutCubic for a smooth finish.
 * - IntersectionObserver triggers it once, then disconnects.
 * - Honors `prefers-reduced-motion` by jumping straight to the final value.
 */
export default function CountUp({
    end,
    prefix = '',
    suffix = '',
    duration = 1800,
    decimals = 0,
    className,
}: CountUpProps) {
    const ref = useRef<HTMLSpanElement>(null)
    const started = useRef(false)
    const [value, setValue] = useState(0)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const reduce =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

        if (reduce || typeof IntersectionObserver === 'undefined') {
            setValue(end)
            return
        }

        const run = () => {
            if (started.current) return
            started.current = true
            const startTime = performance.now()
            const tick = (now: number) => {
                const p = Math.min((now - startTime) / duration, 1)
                const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
                setValue(end * eased)
                if (p < 1) requestAnimationFrame(tick)
                else setValue(end)
            }
            requestAnimationFrame(tick)
        }

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    run()
                    io.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [end, duration])

    const display =
        decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))

    return (
        <span ref={ref} className={className}>
            {prefix}
            {display}
            {suffix}
        </span>
    )
}
