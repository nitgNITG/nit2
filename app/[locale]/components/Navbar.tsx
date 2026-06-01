'use client'
import React, { useState } from 'react'
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

    const isActive = (href: string) =>
        href === '/' ? pathname === `/${locale}` : `/${locale}${href}` === pathname

    return (
        <nav>
            <div className='bg-white px-5 sm:px-10 md:px-16 lg:px-20 py-5 lg:py-10 rounded-r-full rounded-l-full lg:shadow-2xl'>
                <div className='flex justify-between items-center'>

                    {/* Logo + Nav */}
                    <div className='flex items-center gap-5 lg:gap-10'>
                        <Link href='/'>
                            <Logo className='' />
                        </Link>
                        <ul className='hidden lg:flex gap-5'>
                            {items.map((item) => (
                                <li key={item.href}>
                                    <LocalLink
                                        className={clsx(
                                            'font-semibold',
                                            { 'font-bold underline text-[#00FFB2]': isActive(item.href) }
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
                            className='block bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'
                        >
                            <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocalLink>
                        <LangSwitcher />
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => { setOpen(true); document.body.style.overflowY = 'hidden' }}
                        className='lg:hidden'
                    >
                        <MenuIcon className='size-8' />
                    </button>
                </div>
            </div>

            {/* Mobile drawer */}
            <div className={clsx(
                'fixed w-full h-svh left-0 top-0 z-[9999] bg-gradient-to-r from-[#07221D] to-[#1A8872]',
                open ? 'bottomToTop pointer-events-auto' : 'topToBottom pointer-events-none',
            )}>
                <div className='flex flex-col items-center justify-between h-full pb-10 overflow-y-auto'>
                    <div className='relative w-full'>
                        <button
                            onClick={close}
                            className={clsx('absolute top-5', isAr ? 'left-5' : 'right-5')}
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
                                                'font-semibold',
                                                { 'font-bold underline text-[#00FFB2]': isActive(item.href) }
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
                            className='block w-fit bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-4 rounded-md'
                        >
                            <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocalLink>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
