import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'iOS & Android eCommerce Apps',
        titleAr: 'تطبيقات iOS وAndroid للتجارة الإلكترونية',
        desc: 'Native mobile apps published on Google Play and Apple App Store with smooth UX and fast checkout.',
        descAr: 'تطبيقات جوال منشورة على Google Play وApp Store بتجربة مستخدم سلسة وسرعة في الشراء.',
    },
    {
        id: 2,
        title: 'Multivendor Marketplace',
        titleAr: 'سوق متعدد البائعين',
        desc: 'Full multivendor platforms where multiple sellers manage their own stores under one roof.',
        descAr: 'منصات متعددة البائعين حيث يدير كل بائع متجره الخاص تحت سقف واحد.',
    },
    {
        id: 3,
        title: 'Payment Gateway Integration',
        titleAr: 'تكامل بوابات الدفع',
        desc: 'Full integration with Fawry, PayMob, Stripe, PayPal, COD and all major Egyptian & Gulf payment methods.',
        descAr: 'تكامل كامل مع فوري، PayMob، Stripe، PayPal، الدفع عند الاستلام وكل وسائل الدفع.',
    },
    {
        id: 4,
        title: 'Selling Points & POS Systems',
        titleAr: 'نقاط البيع وأنظمة POS',
        desc: 'Integrated POS systems connecting your physical selling points to your online store in real time.',
        descAr: 'أنظمة POS متكاملة تربط نقاط بيعك الفعلية بمتجرك الإلكتروني في الوقت الفعلي.',
    },
    {
        id: 5,
        title: 'Admin Dashboard & Analytics',
        titleAr: 'لوحة التحكم والتحليلات',
        desc: 'Full admin panel: product management, orders, inventory, promotions, and sales analytics.',
        descAr: 'لوحة تحكم كاملة: إدارة المنتجات، الطلبات، المخزون، العروض وتحليل المبيعات.',
    },
]

const EcommerceFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='eCommerce App Development'
                            loading='lazy'
                            width={1000}
                            height={1000}
                            className='w-full h-full'
                        />
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6 lg:order-first'>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <p className={clsx('text-sm text-gray-500', isAr ? 'text-right' : 'text-left')}>
                                {isAr ? 'eCommerce · تجارة إلكترونية' : 'eCommerce · Mobile Apps'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <>تطوير تطبيقات <span className='text-darkAquaMint'>التجارة الإلكترونية</span></>
                                            : <>eCommerce <span className='text-darkAquaMint'>App</span> Development</>}
                                    </h2>
                                </div>
                                <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                            </div>
                        </div>
                        <ul>
                            {features.map((feature, i) => (
                                <li
                                    key={feature.id}
                                    className={clsx('px-10 py-3', { 'bg-white rounded-xl': i === 0 })}
                                >
                                    <div className='flex items-center gap-3 justify-start flex-row-reverse'>
                                        <div className={clsx('flex flex-col gap-1', isAr ? 'items-end' : 'items-start')}>
                                            <h3 className={clsx('text-base font-bold w-10/12', isAr ? 'text-right' : 'text-left')}>{isAr ? feature.titleAr : feature.title}</h3>
                                            <p className={clsx('text-sm text-gray-500 lg:w-10/12', isAr ? 'text-right' : 'text-left')}>{isAr ? feature.descAr : feature.desc}</p>
                                        </div>
                                        <div className='text-[88px] bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c] flex-shrink-0'>{i + 1}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className={clsx('flex', isAr ? 'justify-end' : 'justify-start')}>
                            <LocaleLink href='/contact' target='_blank' className='bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                                <span className='text-[#00FFB2] font-bold'>{isAr ? 'ابدأ مشروعك الآن' : 'Start Your Project'}</span>
                            </LocaleLink>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default EcommerceFeatures
