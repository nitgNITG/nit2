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
    const t = useTranslations('Navbar');
    const locale = useLocale()
    const [open, setOpen] = useState(false)
    const items = [
        { name: t("item1"), href: '/' },
        { name: t('item2'), href: '/who-us' },
        { name: t('item3'), href: '/our-projects' },
        { name: t('item6'), href: '/moodle-lms' },
        { name: t('item7'), href: '/ecommerce-app' },
        { name: t('item4'), href: '/blog' },
        { name: t('item5'), href: '/contact' },
    ]
    const close = () => {
        setOpen(!open)
        document.body.style.overflowY = 'auto'
    }
    return (
        <nav>
            <div className='bg-white px-5 sm:px-10 md:px-16 lg:px-20 py-5 lg:py-10 rounded-r-full rounded-l-full lg:shadow-2xl'>
                <div className={clsx('flex justify-between items-center')}>
                    <div className='hidden lg:flex gap-2 items-center'>
                        <LocalLink href={'/contact'} target='_blank' className=' block bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                            <span className='text-[#00FFB2] font-bold'>
                                {t('btn')}
                            </span>
                        </LocalLink>
                        <LangSwitcher />
                    </div>
                    <button
                        onClick={() => {
                            setOpen(true)
                            document.body.style.overflowY = 'hidden'
                        }}
                        className='lg:hidden'>
                        <MenuIcon className='size-8' />
                    </button>
                    <div className={clsx('flex items-center gap-5 lg:gap-10')}>
                        <ul className='hidden lg:flex gap-5'>
                            {items.slice().reverse().map((item) => (
                                <li key={item.href}>
                                    <LocalLink
                                        className={clsx(
                                            { 'font-semibold': `/${locale}${item.href}` != pathname },
                                            { 'font-bold underline text-[#00FFB2]': item.href == '/' ? pathname == `/${locale}` : `/${locale}${item.href}` == pathname }
                                        )}
                                        href={item.href}
                                    >
                                        {item.name}
                                    </LocalLink>
                                </li>
                            ))}
                        </ul>
                        <Link href={'/'}>
                            <Logo className='' />
                        </Link>
                    </div>
                </div>
            </div>
            <div className={clsx(
                'fixed w-full h-full left-0 top-0 z-[9999] bg-gradient-to-r from-[#07221D] to-[#1A8872]',
                { 'bottomToTop': open },
                { 'topToBottom': !open },
            )}>
                <div className='flex flex-col items-center justify-between h-full pb-10'>
                    <div className='relative w-full'>
                        <button onClick={close} className='absolute top-5 right-5'>
                            <CloseIcon className='size-8 stroke-white' />
                        </button>
                        <div className='pt-20'>
                            <ul className='text-white text-center space-y-8'>
                                {items.map((item) => (
                                    <li key={item.href}>
                                        <LocalLink
                                            onClick={close}
                                            className={clsx(
                                                { 'font-semibold': `/${locale}${item.href}` != pathname },
                                                { 'font-bold underline text-[#00FFB2]': `/${locale}${item.href}` == pathname }
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
                    <LocalLink href={'/contact'} target='_blank' className='block w-fit bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-4 rounded-md'>
                        <span className='text-[#00FFB2] font-bold'>
                            {t('btn')}
                        </span>
                    </LocalLink>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
