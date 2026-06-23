import Image from 'next/image'
import React from 'react'
import service from '../../assets/services.webp'
import clsx from 'clsx'
import { useTranslations, useLocale } from 'next-intl'
import LocaleLink from './LocaleLink'

const OurServices = () => {
    const t = useTranslations('services')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const services = [
        { id: 1, title: t('item1.title'), desc: t('item1.desc') },
        { id: 2, title: t('item2.title'), desc: t('item2.desc') },
        { id: 3, title: t('item3.title'), desc: t('item3.desc') },
    ]

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] pt-96 sm:pt-52 md:pt-32 pb-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>

                {/* Image — يسار للعربي، يمين للإنجليزي */}
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image src={service} alt='خدمات شركة NIT في تطوير البرمجيات والمتاجر الإلكترونية' loading="lazy" placeholder="blur" quality={75} sizes="(max-width: 1024px) 95vw, 45vw" width={1000} height={1000} className='w-full h-full' />
                    </div>
                </div>

                {/* Content */}
                <div className='col-span-12 lg:col-span-6 lg:order-first'>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-start' : 'justify-end flex-row-reverse')}>
                                {isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />}
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        <div className='m-4'>
                                            {t('title.one')}<span className='text-darkAquaMint'>{' ' + t('title.hero') + ' '}</span>{t('title.two')}
                                        </div>
                                    </h2>
                                </div>
                                {!isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />}
                            </div>
                        </div>

                        <ul>
                            {services.map((s, i) => (
                                <li key={s.id} className={clsx('px-10 py-3', { 'bg-white rounded-xl': i === 0 })}>
                                    <div className='flex items-center gap-3 justify-start flex-row-reverse'>
                                        <div className={clsx('flex flex-1 min-w-0 flex-col gap-1', isAr ? 'items-end' : 'items-start')}>
                                            <h3 className={clsx('text-base font-bold w-10/12', isAr ? 'text-right' : 'text-left')}>{s.title}</h3>
                                            <p className={clsx('text-sm text-gray-500 lg:w-10/12', isAr ? 'text-right' : 'text-left')}>{s.desc}</p>
                                        </div>
                                        <div className='text-[88px] leading-none bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c] flex-shrink-0 w-16 text-center'>
                                            {i + 1}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className={clsx('flex', isAr ? 'justify-end' : 'justify-start')}>
                            <LocaleLink
                                href='/get-quote'
                                className='hidden lg:block bg-gradient-to-r from-[#1E7D67] to-[#0B2923] px-5 py-3 rounded-md hover:opacity-90 transition-opacity'
                            >
                                <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                            </LocaleLink>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default OurServices
