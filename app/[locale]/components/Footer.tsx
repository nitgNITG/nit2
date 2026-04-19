'use client'
import React from 'react'
import img from '../../assets/footer_logo.png'
import Image from 'next/image'
import Link from 'next/link'
import LocaleLink from './LocaleLink'
import { useTranslations, useLocale } from 'next-intl'

const Footer = () => {
    const t = useTranslations('footer')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const services = isAr
        ? ["إنشاء منصة تعليمية", "تصميم متجر الكتروني", "تصميم موقع الكتروني لبيع المنتجات والخدمات", "دعم كامل لطرق الدفع الالكتروني", "تصميم مواقع انترنت", "تصميم ألعاب الكترونية", "خدمات ذوى الأعاقة"]
        : ["E-Learning Platform Development", "eCommerce Store Design", "Website Design & Development", "Payment Gateway Integration", "Internet Website Design", "Educational Game Development", "Accessibility Services"]

    return (
        <footer className='bg-[#0F1922] text-white p-container pt-10 lg:pt-20'>
            <div className={`flex flex-wrap sm:flex-nowrap gap-20 ${isAr ? 'justify-between' : 'justify-between flex-row-reverse'}`}>

                {/* Logo + CTA */}
                <div className='flex justify-center w-full sm:justify-normal'>
                    <div className='flex flex-col items-center gap-10'>
                        <Image src={img} alt='NIT Logo' height={250} width={250} />
                        <LocaleLink
                            href='/contact'
                            target='_blank'
                            className='block bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-4 rounded-md'
                        >
                            <span className='text-[#00FFB2] font-bold'>{t('btn')}</span>
                        </LocaleLink>
                    </div>
                </div>

                {/* Services list */}
                <div className={`space-y-5 flex flex-col w-full ${isAr ? 'items-end' : 'items-start'}`}>
                    <h6 className='text-xl font-bold'>{t('services')}</h6>
                    <ul className='space-y-3'>
                        {services.map(item => (
                            <li key={item}>
                                <div className={`flex gap-2 items-center ${isAr ? 'justify-end' : 'justify-start'}`}>
                                    {!isAr && <div className='size-1 bg-white flex-shrink-0' />}
                                    <p className='font-medium'>{item}</p>
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
