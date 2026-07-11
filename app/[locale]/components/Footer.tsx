import React from 'react'
import img from '../../assets/footer_logo.webp'
import Image from 'next/image'
import LocaleLink from './LocaleLink'
import { useTranslations, useLocale } from 'next-intl'

const Footer = () => {
    const t = useTranslations('footer')
    const tn = useTranslations('Navbar')
    const locale = useLocale()
    const isAr = locale === 'ar'

    // Service landing pages, grouped the same way as the navbar dropdown so the
    // footer mirrors the site's information architecture. Each group renders as
    // its own column.
    const serviceGroups = [
        {
            title: tn('cat_elearning'),
            items: [
                { label: tn('cat_elearning_1'), href: '/our-services/moodle-lms' },
                { label: tn('cat_elearning_2'), href: '/our-services/educational-platforms' },
                { label: tn('cat_elearning_3'), href: '/our-services/ai-educational-platforms' },
                { label: tn('cat_elearning_4'), href: '/our-services/school-management' },
            ],
        },
        {
            title: tn('cat_ecommerce'),
            items: [
                { label: tn('cat_ecommerce_4'), href: '/our-services/ecommerce-app' },
                { label: tn('cat_ecommerce_1'), href: '/our-services/delivery-app' },
                { label: tn('cat_ecommerce_2'), href: '/our-services/restaurant-app' },
                { label: tn('cat_ecommerce_3'), href: '/our-services/loyalty-app' },
            ],
        },
        {
            title: tn('cat_dev'),
            items: [
                { label: tn('cat_dev_1'), href: '/our-services/android-app' },
                { label: tn('cat_dev_2'), href: '/our-services/ios-app' },
                { label: tn('cat_dev_3'), href: '/our-services/website-design' },
            ],
        },
    ]

    return (
        <footer className='bg-[#0F1922] text-white' dir={isAr ? 'rtl' : 'ltr'}>
            <div className='p-container pt-14 lg:pt-20 pb-10'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8'>

                    {/* Brand + CTA */}
                    <div className='sm:col-span-2 lg:col-span-3 flex flex-col items-center lg:items-start gap-6 text-center lg:text-start'>
                        <Image
                            src={img}
                            alt='شعار شركة NIT الوطنية لتقنية المعلومات'
                            height={190}
                            width={190}
                            quality={90}
                            sizes='190px'
                            loading='lazy'
                        />
                        <LocaleLink
                            href='/contact'
                            target='_blank'
                            className='inline-block bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-3.5 rounded-lg hover:opacity-90 transition-opacity'
                        >
                            <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocaleLink>
                    </div>

                    {/* Service groups — one column each */}
                    {serviceGroups.map((group) => (
                        <div key={group.title} className='lg:col-span-3 space-y-4'>
                            <h3 className='flex items-center gap-2 text-base font-bold text-[#00FFB2]'>
                                <span className='inline-block size-2 rotate-45 rounded-[2px] bg-[#00FFB2]/80' aria-hidden='true' />
                                {group.title}
                            </h3>
                            <ul className='space-y-2.5'>
                                {group.items.map((item) => (
                                    <li key={item.href}>
                                        <LocaleLink
                                            href={item.href}
                                            className='group inline-flex items-center gap-2 text-sm text-white/65 hover:text-[#00FFB2] transition-colors'
                                        >
                                            <span
                                                className={`text-[#1E7D67] text-xs transition-transform duration-200 ${isAr ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`}
                                                aria-hidden='true'
                                            >
                                                {isAr ? '◂' : '▸'}
                                            </span>
                                            {item.label}
                                        </LocaleLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom bar */}
            <div className='border-t border-white/10'>
                <div className='p-container py-6 flex flex-col sm:flex-row items-center justify-between gap-2'>
                    <span className='text-sm text-white/50'>{t('rights')}</span>
                    <a
                        href={`/${locale}/privacy-policy`}
                        className='text-sm text-white/40 hover:text-white/70 transition-colors'
                    >
                        {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
                    </a>
                </div>
            </div>
        </footer>
    )
}

export default Footer
