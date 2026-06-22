import React from 'react'
import img from '../../assets/footer_logo.webp'
import Image from 'next/image'
import Link from 'next/link'
import LocaleLink from './LocaleLink'
import { useTranslations, useLocale } from 'next-intl'

const Footer = () => {
    const t = useTranslations('footer')
    const locale = useLocale()
    const isAr = locale === 'ar'

    // Service landing pages are linked; the rest stay as plain text labels.
    const services: { label: string; href?: string }[] = isAr
        ? [
            { label: "إنشاء منصة تعليمية (Moodle)", href: "/our-services/moodle-lms" },
            { label: "تطوير متجر وتطبيق تجارة إلكترونية", href: "/our-services/ecommerce-app" },
            { label: "تطبيقات التوصيل وطلب الطعام", href: "/our-services/delivery-app" },
            { label: "تطبيقات وأنظمة المطاعم", href: "/our-services/restaurant-app" },
            { label: "أنظمة ولاء العملاء والنقاط", href: "/our-services/loyalty-app" },
            { label: "تصميم مواقع انترنت" },
            { label: "خدمات ذوى الأعاقة" },
        ]
        : [
            { label: "E-Learning Platform Development", href: "/our-services/moodle-lms" },
            { label: "eCommerce Store & App Development", href: "/our-services/ecommerce-app" },
            { label: "Delivery & Food Ordering Apps", href: "/our-services/delivery-app" },
            { label: "Restaurant Apps & Systems", href: "/our-services/restaurant-app" },
            { label: "Customer Loyalty & Rewards", href: "/our-services/loyalty-app" },
            { label: "Website Design & Development" },
            { label: "Accessibility Services" },
        ]

    return (
        <footer className='bg-[#0F1922] text-white p-container pt-10 lg:pt-20'>
            <div className={`flex flex-wrap sm:flex-nowrap gap-20 ${isAr ? 'justify-between' : 'justify-between flex-row-reverse'}`}>

                {/* Logo + CTA */}
                <div className='flex justify-center w-full sm:justify-normal'>
                    <div className='flex flex-col items-center gap-10'>
                        <Image src={img} alt='شعار شركة NIT الوطنية لتقنية المعلومات' height={250} width={250} quality={90} sizes="250px" loading='lazy' />
                        <LocaleLink
                            href='/contact'
                            target='_blank'
                            className='block bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-5 py-4 rounded-md'
                        >
                            <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocaleLink>
                    </div>
                </div>

                {/* Services list */}
                <div className={`space-y-5 flex flex-col w-full ${isAr ? 'items-end' : 'items-start'}`}>
                    <span className='text-xl font-bold block'>{t('services')}</span>
                    <ul className='space-y-3'>
                        {services.map(item => (
                            <li key={item.label}>
                                <div className={`flex gap-2 items-center ${isAr ? 'justify-end' : 'justify-start'}`}>
                                    {!isAr && <div className='size-1 bg-white flex-shrink-0' />}
                                    {item.href
                                        ? <LocaleLink href={item.href} className='font-medium hover:text-[#00FFB2] transition-colors'>{item.label}</LocaleLink>
                                        : <p className='font-medium'>{item.label}</p>}
                                    {isAr && <div className='size-1 bg-white flex-shrink-0' />}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className='text-center py-10'>
                <span className='font-semibold'>{t('rights')}</span>
            </div>
        </footer>
    )
}

export default Footer
