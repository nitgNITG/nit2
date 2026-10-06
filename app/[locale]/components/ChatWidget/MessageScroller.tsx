'use client'
// Chat transcript scroller — the same parts and behaviour as shadcn's
// MessageScroller (Provider / Root / Viewport / Content / Item / Button), built
// locally because its primitive (@shadcn/react) requires React 19 and this app is
// on React 18. Behaviour:
//  • follows the live edge while a reply streams, as long as the reader is at the bottom;
//  • stops following the moment the reader scrolls up, and shows a "latest" button;
//  • a new visitor turn (scrollAnchor) always brings the view back to the bottom.
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'

type Ctx = {
    viewportRef: React.RefObject<HTMLDivElement>
    contentRef: React.RefObject<HTMLDivElement>
    atEnd: boolean
    scrollToEnd: (behavior?: ScrollBehavior) => void
    follow: React.MutableRefObject<boolean>
    onScroll: () => void
}
const ScrollerContext = createContext<Ctx | null>(null)

const useScroller = () => {
    const ctx = useContext(ScrollerContext)
    if (!ctx) throw new Error('MessageScroller parts must be inside <MessageScrollerProvider>')
    return ctx
}

const END_SLACK = 48 // px from the bottom that still counts as "at the end"

export function MessageScrollerProvider({ children }: { children: React.ReactNode }) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const follow = useRef(true)
    const [atEnd, setAtEnd] = useState(true)

    const scrollToEnd = useCallback((behavior: ScrollBehavior = 'auto') => {
        const el = viewportRef.current
        if (!el) return
        follow.current = true
        el.scrollTo?.({ top: el.scrollHeight, behavior })
        setAtEnd(true)
    }, [])

    const onScroll = useCallback(() => {
        const el = viewportRef.current
        if (!el) return
        const end = el.scrollHeight - el.scrollTop - el.clientHeight <= END_SLACK
        follow.current = end
        setAtEnd(end)
    }, [])

    // Follow the live edge as content grows (streaming deltas, new rows, images).
    useEffect(() => {
        const content = contentRef.current
        if (!content || typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(() => { if (follow.current) scrollToEnd() })
        ro.observe(content)
        return () => ro.disconnect()
    }, [scrollToEnd])

    return (
        <ScrollerContext.Provider value={{ viewportRef, contentRef, atEnd, scrollToEnd, follow, onScroll }}>
            {children}
        </ScrollerContext.Provider>
    )
}

export function MessageScroller({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div data-slot='message-scroller' className={clsx('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)} {...props} />
}

export function MessageScrollerViewport({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const { viewportRef, onScroll } = useScroller()
    return (
        <div
            ref={viewportRef}
            onScroll={onScroll}
            data-slot='message-scroller-viewport'
            className={clsx('min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]', className)}
            {...props}
        />
    )
}

export function MessageScrollerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const { contentRef } = useScroller()
    return <div ref={contentRef} data-slot='message-scroller-content' className={clsx('flex min-h-full flex-col gap-3', className)} {...props} />
}

/** One transcript row. scrollAnchor rows (the visitor's own turns) jump the view to the end when they appear. */
export function MessageScrollerItem({ scrollAnchor = false, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { scrollAnchor?: boolean }) {
    const { scrollToEnd } = useScroller()
    useLayoutEffect(() => {
        if (scrollAnchor) scrollToEnd()
    }, [scrollAnchor, scrollToEnd])
    return <div data-slot='message-scroller-item' className={clsx('min-w-0 shrink-0', className)} {...props} />
}

/** Floating "jump to the latest message" button; visible only when the reader scrolled up. */
export function MessageScrollerButton({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    const { atEnd, scrollToEnd } = useScroller()
    return (
        <button
            type='button'
            aria-label={label}
            tabIndex={atEnd ? -1 : 0}
            aria-hidden={atEnd}
            onClick={() => scrollToEnd('smooth')}
            data-active={!atEnd}
            className={clsx(
                'absolute bottom-3 left-1/2 -translate-x-1/2 flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition-all duration-200 hover:bg-gray-50',
                atEnd ? 'pointer-events-none translate-y-2 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100',
                className,
            )}
        >
            {children}
        </button>
    )
}
