'use client'
// Loads the chat widget only after the page is interactive and idle (NFR-11), and
// never on dashboard / payment / sign-in pages (FR-W1). Its code is a separate chunk.
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { widgetAllowedOn } from '@/lib/agent/placement'

const ChatWidget = dynamic(() => import('./ChatWidget'), { ssr: false })

export default function ChatWidgetLoader({ locale }: { locale: string }) {
    const pathname = usePathname() ?? '/'
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
        if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true), { timeout: 4000 })
        else setTimeout(() => setReady(true), 1500)
    }, [])

    if (!ready || !widgetAllowedOn(pathname)) return null
    return <ChatWidget locale={locale === 'en' ? 'en' : 'ar'} pathname={pathname} />
}
