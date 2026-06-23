import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'Customer, Driver & Admin Apps',
        titleAr: 'تطبيق العميل والسائق ولوحة التحكم',
        desc: 'A complete 3-sided system: a customer ordering app, a driver delivery app, and a web admin dashboard.',
        descAr: 'منظومة متكاملة من 3 أطراف: تطبيق للعميل لطلب الخدمة، تطبيق للسائق للتوصيل، ولوحة تحكم ويب للإدارة.',
    },
    {
        id: 2,
        title: 'Live GPS Order Tracking',
        titleAr: 'تتبع الطلب المباشر بالخريطة',
        desc: 'Real-time GPS tracking of the driver on the map from pickup to the customer’s door.',
        descAr: 'تتبع موقع السائق مباشرة على الخريطة من الاستلام حتى باب العميل في الوقت الفعلي.',
    },
    {
        id: 3,
        title: 'Multi-Service Delivery',
        titleAr: 'توصيل متعدد الخدمات',
        desc: 'One app for food, groceries, pharmacy and general supplies — multiple categories and vendors.',
        descAr: 'تطبيق واحد لتوصيل الطعام والبقالة والصيدلية والتوريدات — فئات وبائعين متعددين.',
    },
    {
        id: 4,
        title: 'Smart Driver Dispatch',
        titleAr: 'توزيع الطلبات الذكي للسائقين',
        desc: 'Automatic assignment of nearby drivers, route optimization, and zone-based delivery pricing.',
        descAr: 'إسناد تلقائي لأقرب سائق، تحسين المسار، وتسعير التوصيل حسب المناطق.',
    },
    {
        id: 5,
        title: 'Payments & Driver Wallets',
        titleAr: 'المدفوعات ومحافظ السائقين',
        desc: 'Mada, STC Pay, KNET, Fawry, cash on delivery and automated driver wallet settlements.',
        descAr: 'مدى، STC Pay، KNET، فوري، الدفع عند الاستلام، وتسوية محافظ السائقين تلقائياً.',
    },
]

const DeliveryFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='Delivery App Development'
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
                                {isAr ? 'Delivery · توصيل' : 'Delivery · On-Demand'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <>تطوير تطبيقات <span className='text-darkAquaMint'>التوصيل</span></>
                                            : <>Delivery <span className='text-darkAquaMint'>App</span> Development</>}
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

export default DeliveryFeatures
