'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import clsx from 'clsx'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import useClickOutside from '../../hook/useClickOutSide'
import { Logo, MenuIcon } from '../../components/icons'
import LocaleLink from '../../components/LocaleLink'
import { useLocale } from 'next-intl'

const Sidebar = () => {
    const { unReadContact, setUnReadContact }: any = useStore()
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const locale = useLocale()
    const items = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: '🎓 Academies', href: '/dashboard/academies' },
        { label: 'Projects', href: '/dashboard/projects' },
        { label: 'Project Types', href: '/dashboard/types' },
        { label: 'Sponsers', href: '/dashboard/sponsers' },
        { label: 'Contacts', href: '/dashboard/contacts' },
        { label: 'Blog', href: '/dashboard/blog' },
        { label: '💰 Plans & Pricing', href: '/dashboard/plans' },
        { label: '🌐 Platform Settings', href: '/dashboard/platform-settings' },
        { label: '⚙️ Setup & Health', href: '/dashboard/setup' },
    ]
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
        fetchContactsCount()
    }, [fetchContactsCount])

    return (
        <>
            <div className='px-5 md:px-10 pt-8 lg:hidden sticky top-0 z-10 bg-gray-100'>
                <button onClick={() => setOpen(!open)}>
                    <MenuIcon className='size-8' />
                </button>
            </div>
            <div>
                <div ref={eleRef} className={`w-64 border-r-2 min-h-svh fixed lg:sticky top-0 z-10 bg-white ${open ? 'rtl' : 'ltr'}`}>
                    <LocaleLink href={'/'} className='w-full flex justify-center py-10'>
                        <Logo className='size-28' />
                    </LocaleLink>
                    <div className='relative flex items-center'>
                        <div className='bg-white ml-3 z-10 px-1 text-black/40 text-sm'>Admin Interaction</div>
                        <div className='absolute w-full h-[1px] bg-black/10' />
                    </div>
                    <div className='pt-2'>
                        <div className='w-full'>
                            {items.map((item, index) => (
                                <LocaleLink
                                    onClick={() => setOpen(false)}
                                    key={index}
                                    href={item.href}
                                    className={clsx(
                                        'flex justify-between items-center w-full py-2 pl-5 pr-2 hover:bg-gray-100 rounded-md duration-200',
                                        { 'bg-gray-100': pathname === `/${locale}${item.href}` },
                                        { 'text-blue-600 font-semibold': item.href === '/dashboard/setup' }
                                    )}
                                >
                                    <span className='text-lg'>{item.label}</span>
                                    {(item.label === 'Contacts' && unReadContact)
                                        ? <span className='text-xs bg-red-500 size-4 flex justify-center items-center text-white rounded-full'>{unReadContact}</span>
                                        : ''}
                                </LocaleLink>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Sidebar
