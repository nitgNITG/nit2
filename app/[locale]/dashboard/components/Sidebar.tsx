'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
import {
    LuBadgeDollarSign, LuBell, LuBellOff, LuBot, LuCalendarClock, LuChartColumn, LuChartLine, LuContact, LuCreditCard,
    LuFolderKanban, LuGlobe, LuGraduationCap, LuHandshake, LuHeartPulse, LuInbox, LuKeyRound, LuLayoutDashboard,
    LuMenu, LuNewspaper, LuPlug, LuReceipt, LuSparkles, LuStore, LuTags, LuTicket, LuUserCog, LuX,
} from 'react-icons/lu'
import useClickOutside from '../../hook/useClickOutSide'
import { Logo } from '../../components/icons'
import LocaleLink from '../../components/LocaleLink'
import { useLocale } from 'next-intl'
import { ADMIN_NAV, groupNav, isActive, type NavIcon, type NavItem } from '@/lib/dashboard/nav'
import { useInboxAlerts } from './useInboxAlerts'

const ICONS: Record<NavIcon, IconType> = {
    dashboard: LuLayoutDashboard, projects: LuFolderKanban, types: LuTags, sponsors: LuHandshake, contacts: LuContact,
    blog: LuNewspaper, plans: LuBadgeDollarSign, academies: LuGraduationCap, stores: LuStore, payments: LuCreditCard,
    revenue: LuChartLine, licenses: LuKeyRound, platform: LuGlobe, integrations: LuPlug, health: LuHeartPulse,
    inbox: LuInbox, priceRanges: LuReceipt, tickets: LuTicket, meetings: LuCalendarClock, usage: LuChartColumn,
    analytics: LuSparkles, aiSettings: LuBot, staff: LuUserCog,
}

function Badge({ n, tone = 'red', title }: { n: number; tone?: 'red' | 'amber'; title?: string }) {
    if (!n) return null
    return (
        <span title={title} className={clsx(
            'ms-auto min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold leading-5 text-center text-white',
            tone === 'red' ? 'bg-red-500' : 'bg-amber-500',
        )}>{n > 99 ? '99+' : n}</span>
    )
}

// isAdmin: the full admin menu. Otherwise (AI-agent staff) only the agent pages
// their permissions allow — computed server-side in the dashboard layout.
const Sidebar = ({ isAdmin = true, agentItems = [] }: { isAdmin?: boolean; agentItems?: NavItem[] }) => {
    const { unReadContact, setUnReadContact }: any = useStore()
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const locale = useLocale()
    const groups = groupNav(isAdmin ? [...ADMIN_NAV, ...agentItems] : agentItems)
    const hasInbox = agentItems.some((i) => i.badge === 'inbox')
    const inbox = useInboxAlerts(hasInbox)
    const eleRef = useClickOutside(() => { setOpen(false) }, open)
    const fetchContactsCount = useCallback(
        async () => {
            try {
                const { data } = await axios.get('/api/contact?isRead=true')
                setUnReadContact(data.count)
            } catch (error) {
                console.error(error)
            }
        }, [setUnReadContact]
    )
    useEffect(() => {
        if (isAdmin) fetchContactsCount() // the contacts API is admin-only
    }, [fetchContactsCount, isAdmin])

    return (
        <>
            <div className='px-5 md:px-10 pt-6 lg:hidden sticky top-0 z-10 bg-gray-100'>
                <button aria-label='Open menu' onClick={() => setOpen(!open)} className='relative rounded-lg p-1.5 hover:bg-gray-200'>
                    <LuMenu className='size-7' />
                    {inbox.waiting > 0 && <span className='absolute top-0.5 right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-gray-100' />}
                </button>
            </div>
            <div>
                <aside ref={eleRef} className={`w-64 border-r border-gray-200 h-svh fixed lg:sticky top-0 z-20 bg-white flex flex-col ${open ? 'rtl' : 'ltr'}`}>
                    <div className='relative flex items-center justify-center py-6 border-b border-gray-100'>
                        <LocaleLink href={'/'} aria-label='Website home'>
                            <Logo className='size-20' />
                        </LocaleLink>
                        <button aria-label='Close menu' onClick={() => setOpen(false)} className='lg:hidden absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100'>
                            <LuX className='size-5' />
                        </button>
                    </div>

                    <nav aria-label='Dashboard' className='flex-1 overflow-y-auto px-3 py-4 space-y-5'>
                        {!isAdmin && <p className='px-3 text-xs text-gray-500'>AI assistant team</p>}
                        {groups.map((g) => (
                            <div key={g.key}>
                                <div className='px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400'>{g.label}</div>
                                <ul className='space-y-0.5'>
                                    {g.items.map((item) => {
                                        const Icon = ICONS[item.icon]
                                        const active = isActive(pathname, locale, item.href)
                                        return (
                                            <li key={item.href}>
                                                <LocaleLink
                                                    onClick={() => setOpen(false)}
                                                    href={item.href}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={clsx(
                                                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                                        active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                                                    )}
                                                >
                                                    <Icon aria-hidden className={clsx('size-[18px] shrink-0', active ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600')} />
                                                    <span className='truncate'>{item.label}</span>
                                                    {item.badge === 'contacts' && <Badge n={Number(unReadContact) || 0} title='Unread contacts' />}
                                                    {item.badge === 'inbox' && (
                                                        <span className='ms-auto flex gap-1'>
                                                            <Badge n={inbox.waiting} title='Waiting for a person' />
                                                            <Badge n={inbox.mine} tone='amber' title='Assigned to you' />
                                                        </span>
                                                    )}
                                                </LocaleLink>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>

                    {hasInbox && inbox.supported && (
                        <div className='border-t border-gray-100 p-3'>
                            <button type='button' onClick={inbox.toggleDesktop}
                                className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100'
                                title='A sound and a desktop notification when a conversation is handed to your team'>
                                {inbox.desktop ? <LuBell className='size-4 text-emerald-600' /> : <LuBellOff className='size-4 text-gray-400' />}
                                {inbox.desktop ? 'Handoff alerts on' : 'Turn on handoff alerts'}
                            </button>
                            {inbox.blocked && <p className='px-3 text-[11px] text-red-600'>Notifications are blocked in this browser&apos;s site settings.</p>}
                        </div>
                    )}
                </aside>
            </div>
        </>
    )
}

export default Sidebar
