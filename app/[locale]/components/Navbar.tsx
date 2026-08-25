'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, Logo, MenuIcon } from './icons'
import Link from 'next/link'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import LocalLink from './LocaleLink'
import LangSwitcher from './LangSwitcher'
import AuthMenu from './AuthMenu'

const Navbar = () => {
    const pathname = usePathname()
    const t = useTranslations('Navbar')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const [open, setOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const navRef = useRef<HTMLElement>(null)
    const navWrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY
            setIsScrolled(currentScroll >= 40)
            
            // Directly manipulate the DOM for buttery smooth 60fps scrolling
            // without triggering heavy React re-renders on every pixel.
            if (navWrapperRef.current) {
                if (currentScroll < 40) {
                    navWrapperRef.current.style.transform = `translateY(${40 - currentScroll}px)`
                } else {
                    navWrapperRef.current.style.transform = `translateY(0px)`
                }
            }
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Desktop "Services" dropdown. Rendered through a portal to <body> so it
    // escapes the hero header's stacking context (z-10 + overflow-hidden) — a
    // plain absolute panel paints *under* the next section otherwise.
    const [servicesOpen, setServicesOpen] = useState(false)
    // Which categories are expanded inside the dropdown. Each toggles
    // independently so opening one never collapses (and shifts) the others —
    // that shift would otherwise slide content out from under the cursor and
    // trigger the panel's mouse-leave/close. The first category (index 0) is
    // expanded by default each time the panel is shown.
    const [openCats, setOpenCats] = useState<number[]>([0])
    const [ddPos, setDdPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })
    const ddBtnRef = useRef<HTMLButtonElement>(null)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const toggleCat = (i: number) =>
        setOpenCats((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))

    // Reopen → always start with just the first category expanded.
    useEffect(() => {
        if (servicesOpen) setOpenCats([0])
    }, [servicesOpen])

    const openServices = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current)
        setServicesOpen(true)
    }
    const closeServices = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current)
        closeTimer.current = setTimeout(() => setServicesOpen(false), 140)
    }

    // Position the portaled panel from the trigger's live rect — measured after
    // commit (layout settled) and kept in sync while open, so it always sits
    // directly under the button regardless of scroll/resize.
    useEffect(() => {
        if (!servicesOpen) return
        const update = () => {
            const r = ddBtnRef.current?.getBoundingClientRect()
            if (r) {
                setDdPos(isAr
                    ? { top: r.bottom, right: Math.max(8, window.innerWidth - r.right) }
                    : { top: r.bottom, left: r.left })
            }
        }
        update()
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [servicesOpen, isAr])

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

    // The service landing pages grouped by category.
    const services = [
        {
            category: t('cat_elearning'),
            items: [
                { name: t('cat_elearning_1'), href: '/our-services/moodle-lms' },
                { name: t('cat_elearning_2'), href: '/our-services/educational-platforms' },
                { name: t('cat_elearning_3'), href: '/our-services/ai-educational-platforms' },
                { name: t('cat_elearning_4'), href: '/our-services/school-management' },
            ]
        },
        {
            category: t('cat_ecommerce'),
            items: [
                { name: t('cat_ecommerce_4'), href: '/our-services/ecommerce-app' },
                { name: t('cat_ecommerce_1'), href: '/our-services/delivery-app' },
                { name: t('cat_ecommerce_2'), href: '/our-services/restaurant-app' },
                { name: t('cat_ecommerce_3'), href: '/our-services/loyalty-app' },
            ]
        },
        {
            category: t('cat_dev'),
            items: [
                { name: t('cat_dev_1'), href: '/our-services/android-app' },
                { name: t('cat_dev_2'), href: '/our-services/ios-app' },
                { name: t('cat_dev_3'), href: '/our-services/website-design' },
            ]
        }
    ]

    // Flat list for isActive checks
    const allServiceItems = services.flatMap(g => g.items)

    type ServiceCategory = { category: string; items: { name: string; href: string }[] }

    type NavItem =
        | { name: string; href: string }
        | { name: string; children: ServiceCategory[] }

    const items: NavItem[] = [
        { name: t('item1'), href: '/' },
        { name: t('item3'), href: '/our-projects' },
        { name: t('services'), children: services },
        { name: t('item4'), href: '/blog' },
        { name: t('item2'), href: '/who-us' },
        { name: t('item5'), href: '/contact' },
        { name: t('buildProduct'), href: '/account' },
    ]

    const close = () => {
        setOpen(false)
        document.body.style.overflowY = 'auto'
    }

    /* ╔══════════════ UI TWEAKS — toggle by swapping which line is commented ══════════════╗ */

    const NAV_LINK_BASE = 'text-sm 2xl:text-base font-semibold whitespace-nowrap px-2 xl:px-3 2xl:px-4 py-1.5 rounded-full transition-colors hover:bg-[#1E7D67]/5'
    const ACTIVE_LINK_CLASS = 'bg-[#1E7D67]/10 text-[#1E7D67] font-bold ring-1 ring-[#1E7D67]/20'
    const MOBILE_LINK_BASE = 'inline-block font-semibold text-xl px-5 py-2 rounded-full transition-colors'
    const MOBILE_ACTIVE_CLASS = 'bg-[#00FFB2]/15 text-[#00FFB2] font-bold ring-1 ring-[#00FFB2]/30'

    const isActive = (href: string) =>
        href === '/' ? pathname === `/${locale}` : `/${locale}${href}` === pathname

    const NAV_BAR_CLASS = clsx(
        'transition-all duration-700 ease-in-out w-full mx-auto bg-white',
        isScrolled
            ? 'px-5 sm:px-10 md:px-16 lg:px-8 xl:px-12 2xl:px-20 py-1 lg:py-1 rounded-none shadow-md'
            : 'px-5 sm:px-10 md:px-16 lg:px-4 xl:px-8 2xl:px-20 py-1 lg:py-2 rounded-[40px] shadow-lg lg:shadow-2xl'
    )

    return (
        <>
            {/* Invisible placeholder to keep the height in the normal document flow */}
            <div className='w-full opacity-0 pointer-events-none' style={{ height: 100 }} />
            {mounted && createPortal(
                <div 
                    ref={navWrapperRef}
                    className='fixed top-0 left-0 right-0 z-[99999] w-full pointer-events-none'
                    style={{ transform: 'translateY(40px)' }}
                >
                    <nav 
                        ref={navRef}
                        className={clsx(
                            'w-full transition-all duration-700 ease-in-out pointer-events-auto',
                            isScrolled ? 'px-0' : 'p-container'
                        )}
                    >
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
                                'children' in item ? (
                                    <li
                                        key={item.name}
                                        className='relative'
                                        onMouseEnter={openServices}
                                        onMouseLeave={closeServices}
                                    >
                                        <button
                                            type='button'
                                            ref={ddBtnRef}
                                            aria-haspopup='true'
                                            aria-expanded={servicesOpen}
                                            className={clsx(
                                                NAV_LINK_BASE,
                                                'inline-flex items-center gap-1',
                                                { [ACTIVE_LINK_CLASS]: allServiceItems.some((c) => isActive(c.href) && c.href !== '#') }
                                            )}
                                        >
                                            {item.name}
                                            <span className={clsx('text-[10px] transition-transform duration-200', { 'rotate-180': servicesOpen })}>▾</span>
                                        </button>
                                    </li>
                                ) : (
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
                                )
                            ))}
                        </ul>
                    </div>

                    {/* CTA + Auth + LangSwitcher */}
                    <div className='hidden lg:flex gap-2 items-center'>
                        <LocalLink
                            href='/contact'
                            target='_blank'
                            className='block bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-3 2xl:px-5 py-1.5 2xl:py-2 rounded-md whitespace-nowrap'
                        >
                            <span className='text-sm 2xl:text-base text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocalLink>
                        <AuthMenu />
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
            </nav>
            </div>,
            document.body
            )}

            {/* Mobile drawer — rendered via portal directly on <body> to escape
                any ancestor overflow-hidden / stacking-context that breaks fixed */}
            {mounted && createPortal(
                <div className={clsx(
                    'fixed inset-0 w-full h-svh z-[999999] bg-gradient-to-r from-[#07221D] to-[#1A8872]',
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
                                        'children' in item ? (
                                            <li key={item.name} className='space-y-4'>
                                                <span className='block text-[#00FFB2]/60 text-sm font-bold uppercase tracking-widest'>
                                                    {item.name}
                                                </span>
                                                {/* Collapsible categories — tap a title to reveal its sub-items */}
                                                <div className='flex flex-col gap-3 mt-4 px-4'>
                                                    {item.children.map((group, gi) => (
                                                        <details key={group.category} open={gi === 0} className='group/cat border-b border-white/10 pb-3'>
                                                            <summary className='flex items-center justify-center gap-2 cursor-pointer list-none text-[#00FFB2] text-base font-bold opacity-90 uppercase tracking-wider'>
                                                                <span>{group.category}</span>
                                                                <span className='text-xs transition-transform duration-200 group-open/cat:rotate-180' aria-hidden='true'>▾</span>
                                                            </summary>
                                                            <ul className='space-y-3 mt-4'>
                                                                {group.items.map((c) => (
                                                                    <li key={c.href + c.name}>
                                                                        <LocalLink
                                                                            onClick={close}
                                                                            className={clsx(
                                                                                MOBILE_LINK_BASE,
                                                                                'text-lg',
                                                                                { [MOBILE_ACTIVE_CLASS]: isActive(c.href) && c.href !== '#' }
                                                                            )}
                                                                            href={c.href}
                                                                        >
                                                                            {c.name}
                                                                        </LocalLink>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </details>
                                                    ))}
                                                </div>
                                            </li>
                                        ) : (
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
                                        )
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className='flex flex-col items-center gap-4'>
                            <LangSwitcher />
                            <AuthMenu mobile onNavigate={close} />
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

            {/* Desktop "Services" dropdown panel — portaled to <body> so it sits
                above all page sections regardless of header stacking context */}
            {mounted && servicesOpen && createPortal(
                <div
                    style={{ position: 'fixed', top: ddPos.top, left: ddPos.left, right: ddPos.right }}
                    className='z-[999999] pt-2'
                    onMouseEnter={openServices}
                    onMouseLeave={closeServices}
                >
                    {/* Accordion panel: each main title is a button that expands its
                        sub-items below it. One category open at a time; the first is
                        expanded by default whenever the panel is shown. */}
                    <div className='min-w-72 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 p-2'>
                        {services.map((group, gi) => {
                            const hasActive = group.items.some((c) => isActive(c.href) && c.href !== '#')
                            const isExpanded = openCats.includes(gi)
                            return (
                                <div key={group.category} className={clsx(gi > 0 && 'mt-1 border-t border-gray-100 pt-1')}>
                                    <button
                                        type='button'
                                        onClick={() => toggleCat(gi)}
                                        aria-expanded={isExpanded}
                                        className={clsx(
                                            'w-full flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors hover:bg-[#1E7D67]/5',
                                            isExpanded ? 'text-[#1E7D67]' : hasActive ? 'text-[#1E7D67]' : 'text-[#0B2923]',
                                            isAr ? 'text-right' : 'text-left'
                                        )}
                                    >
                                        <span>{group.category}</span>
                                        <span
                                            className={clsx('text-[10px] text-[#1E7D67] transition-transform duration-200', isExpanded && 'rotate-180')}
                                            aria-hidden='true'
                                        >
                                            ▾
                                        </span>
                                    </button>

                                    {/* Sub-items — height-animated accordion body */}
                                    <div
                                        className={clsx(
                                            'overflow-hidden transition-all duration-300 ease-in-out',
                                            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                        )}
                                    >
                                        <div className='overflow-hidden'>
                                            <div className={clsx('py-1', isAr ? 'pr-3' : 'pl-3')}>
                                                {group.items.map((c) => (
                                                    <LocalLink
                                                        key={c.href + c.name}
                                                        href={c.href}
                                                        onClick={() => setServicesOpen(false)}
                                                        className={clsx(
                                                            'block px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors hover:bg-[#1E7D67]/5',
                                                            isActive(c.href) && c.href !== '#' ? 'bg-[#1E7D67]/10 text-[#1E7D67]' : 'text-gray-600',
                                                            isAr ? 'text-right' : 'text-left'
                                                        )}
                                                    >
                                                        {c.name}
                                                    </LocalLink>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}

export default Navbar
