'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, Logo, MenuIcon } from './icons'
import Link from 'next/link'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import LocalLink from './LocaleLink'
import LangSwitcher from './LangSwitcher'

const Navbar = () => {
    const pathname = usePathname()
    const t = useTranslations('Navbar')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    // Replay the attention-grabbing logo flourish every time the visitor lands
    // on the home page (الرئيسية). Toggling off→on across two frames restarts
    // the CSS animation even when the Navbar instance is reused.
    const isHome = pathname === `/${locale}`
    const [logoIntro, setLogoIntro] = useState(false)
    useEffect(() => {
        if (!isHome) { setLogoIntro(false); return }
        setLogoIntro(false)
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => setLogoIntro(true))
        )
        return () => cancelAnimationFrame(id)
    }, [pathname, locale, isHome])

    const items = [
        { name: t('item1'), href: '/' },
        { name: t('item3'), href: '/our-projects' },
        { name: t('item6'), href: '/moodle-lms' },
        { name: t('item7'), href: '/ecommerce-app' },
        { name: t('item4'), href: '/blog' },
        { name: t('item2'), href: '/who-us' },
        { name: t('item5'), href: '/contact' },
    ]

    const close = () => {
        setOpen(false)
        document.body.style.overflowY = 'auto'
    }

    /* ╔══════════════ UI TWEAKS — toggle by swapping which line is commented ══════════════╗ */

    /* ── Navbar bar (white pill): the py-* values control the navbar HEIGHT ── */
    // OLD (taller — original):
    // const NAV_BAR_CLASS = 'bg-white px-5 sm:px-10 md:px-16 lg:px-20 py-5 lg:py-10 rounded-r-full rounded-l-full lg:shadow-2xl'
    // NEW (slimmer height):
    const NAV_BAR_CLASS = 'bg-white px-5 sm:px-10 md:px-16 lg:px-4 xl:px-8 2xl:px-20 py-3 lg:py-5 rounded-r-full rounded-l-full lg:shadow-2xl'

    /* ── Active link indicator — DESKTOP navbar (white bg) ── */
    // The selected page used an underline + light mint (#00FFB2) → ugly + low contrast.
    // Now: every link is a pill; the active one gets a soft teal "chip" highlight (no underline).
    // OLD (original — underline + mint):
    // const NAV_LINK_BASE = 'font-semibold'
    // const ACTIVE_LINK_CLASS = 'font-bold underline text-[#00FFB2]'
    // NEW (pill highlight, accessible teal, no underline):
    const NAV_LINK_BASE = 'text-sm 2xl:text-base font-semibold whitespace-nowrap px-2 xl:px-3 2xl:px-4 py-2 rounded-full transition-colors hover:bg-[#1E7D67]/5'
    const ACTIVE_LINK_CLASS = 'bg-[#1E7D67]/10 text-[#1E7D67] font-bold ring-1 ring-[#1E7D67]/20'

    /* ── Active link indicator — MOBILE drawer (dark green bg) ── */
    // OLD (underline):
    // const MOBILE_LINK_BASE = 'font-semibold text-xl'
    // const MOBILE_ACTIVE_CLASS = 'font-bold underline text-[#00FFB2]'
    // NEW (pill highlight on dark, no underline):
    const MOBILE_LINK_BASE = 'inline-block font-semibold text-xl px-5 py-2 rounded-full transition-colors'
    const MOBILE_ACTIVE_CLASS = 'bg-[#00FFB2]/15 text-[#00FFB2] font-bold ring-1 ring-[#00FFB2]/30'

    /* ╚════════════════════════════════════════════════════════════════════════════════════╝ */

    const isActive = (href: string) =>
        href === '/' ? pathname === `/${locale}` : `/${locale}${href}` === pathname

    return (
        <nav>
            <div className={NAV_BAR_CLASS}>
                <div className='flex justify-between items-center'>

                    {/* Logo + Nav */}
                    <div className='flex items-center gap-5 lg:gap-10'>
                        <Link href='/' aria-label='N.I.T home'>
                            <span className={clsx('logo-intro-wrap', { 'logo-intro': logoIntro })}>
                                <Logo className='' />
                            </span>
                        </Link>
                        <ul className='hidden lg:flex gap-1 items-center'>
                            {items.map((item) => (
                                <li key={item.href}>
                                    <LocalLink
                                        className={clsx(
                                            NAV_LINK_BASE,
                                            { [ACTIVE_LINK_CLASS]: isActive(item.href) }
                                        )}
                                        href={item.href}
                                    >
                                        {item.name}
                                    </LocalLink>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA + LangSwitcher */}
                    <div className='hidden lg:flex gap-2 items-center'>
                        <LocalLink
                            href='/contact'
                            target='_blank'
                            className='block bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-3 2xl:px-5 py-2 2xl:py-3 rounded-md whitespace-nowrap'
                        >
                            <span className='text-sm 2xl:text-base text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocalLink>
                        <LangSwitcher />
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => { setOpen(true); document.body.style.overflowY = 'hidden' }}
                        className='lg:hidden'
                        aria-label='فتح القائمة'
                    >
                        <MenuIcon className='size-8' />
                    </button>
                </div>
            </div>

            {/* Mobile drawer — rendered via portal directly on <body> to escape
                any ancestor overflow-hidden / stacking-context that breaks fixed */}
            {mounted && createPortal(
                <div className={clsx(
                    'fixed inset-0 w-full h-svh z-[9999] bg-gradient-to-r from-[#07221D] to-[#1A8872]',
                    open ? 'bottomToTop pointer-events-auto' : 'topToBottom pointer-events-none',
                )}>
                    <div className='flex flex-col items-center justify-between h-full pb-10 overflow-y-auto'>
                        <div className='relative w-full'>
                            <button
                                onClick={close}
                                className={clsx('absolute top-5', isAr ? 'left-5' : 'right-5')}
                                aria-label='إغلاق القائمة'
                            >
                                <CloseIcon className='size-8 stroke-white' />
                            </button>
                            <div className='pt-20'>
                                <ul className='text-white text-center space-y-8'>
                                    {items.map((item) => (
                                        <li key={item.href}>
                                            <LocalLink
                                                onClick={close}
                                                className={clsx(
                                                    MOBILE_LINK_BASE,
                                                    { [MOBILE_ACTIVE_CLASS]: isActive(item.href) }
                                                )}
                                                href={item.href}
                                            >
                                                {item.name}
                                            </LocalLink>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className='flex flex-col items-center gap-4'>
                            <LangSwitcher />
                            <LocalLink
                                href='/contact'
                                target='_blank'
                                className='block w-fit bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-5 py-4 rounded-md'
                            >
                                <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                            </LocalLink>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </nav>
    )
}

export default Navbar
