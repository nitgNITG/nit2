import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'Branded Ordering App',
        titleAr: 'تطبيق طلب باسم مطعمك',
        desc: 'Your own-brand ordering app on Google Play & App Store — not a commission-eating aggregator.',
        descAr: 'تطبيق طلب بهوية مطعمك على Google Play وApp Store — بدون عمولات تطبيقات الوسطاء.',
    },
    {
        id: 2,
        title: 'Dine-in, Takeaway & Delivery',
        titleAr: 'صالة وتيك أواي وتوصيل',
        desc: 'Handle dine-in QR ordering, takeaway pickup, and home delivery from one system.',
        descAr: 'إدارة الطلب داخل الصالة عبر QR، التيك أواي، والتوصيل للمنزل من نظام واحد.',
    },
    {
        id: 3,
        title: 'Digital Menu & Modifiers',
        titleAr: 'قائمة رقمية وإضافات',
        desc: 'Rich digital menus with categories, add-ons, combos and real-time availability.',
        descAr: 'قوائم رقمية غنية بالفئات والإضافات والعروض وحالة التوفر اللحظية.',
    },
    {
        id: 4,
        title: 'Kitchen & POS System',
        titleAr: 'نظام المطبخ ونقاط البيع',
        desc: 'Kitchen display orders, POS for cashiers, and table/branch management.',
        descAr: 'شاشة طلبات للمطبخ، نقاط بيع للكاشير، وإدارة الطاولات والفروع.',
    },
    {
        id: 5,
        title: 'Offers, Points & Reviews',
        titleAr: 'العروض والنقاط والتقييمات',
        desc: 'Promo codes, loyalty points, ratings and push-notification campaigns to bring customers back.',
        descAr: 'أكواد خصم، نقاط ولاء، تقييمات، وحملات إشعارات لإعادة العملاء.',
    },
]

const RestaurantFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='Restaurant App Development'
                            loading='lazy'
                            width={1000}
                            height={1000}
                            className='w-full h-full'
                        />
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6'>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <p className={clsx('text-sm text-gray-500', isAr ? 'text-right' : 'text-left')}>
                                {isAr ? 'Restaurants · مطاعم' : 'Restaurants · Food Ordering'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <>تطوير تطبيقات <span className='text-darkAquaMint'>المطاعم</span></>
                                            : <>Restaurant <span className='text-darkAquaMint'>App</span> Development</>}
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
                                    <div className={clsx('flex items-center gap-3', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                        <div className={clsx('flex flex-col gap-1', isAr ? 'items-end' : 'items-start')}>
                                            <h3 className={clsx('text-base font-bold', isAr ? 'text-right' : 'text-left')}>{isAr ? feature.titleAr : feature.title}</h3>
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

export default RestaurantFeatures
