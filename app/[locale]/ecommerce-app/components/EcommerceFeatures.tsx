import React from 'react'
import Image from 'next/image'
import service from '../../../assets/services.png'
import clsx from 'clsx'
import LocaleLink from '../../components/LocaleLink'

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

const EcommerceFeatures = () => {
    return (
        <section className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
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
                <div className='col-span-12 lg:col-span-6'>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <p className='text-sm text-gray-500'>eCommerce · Mobile Apps · تجارة إلكترونية</p>
                            <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        eCommerce <span className='text-aquaMint'>App</span> Development
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
                                    <div className='flex justify-end items-center gap-3'>
                                        <div className='flex flex-col items-end gap-1'>
                                            <h3 className='text-base font-bold text-right'>{feature.title}</h3>
                                            <h3 className='text-sm font-semibold text-right text-gray-600'>{feature.titleAr}</h3>
                                            <p className='text-sm text-right text-gray-500 lg:w-10/12'>{feature.desc}</p>
                                        </div>
                                        <div className='text-[88px] bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c] flex-shrink-0'>{i + 1}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className='flex justify-end'>
                            <LocaleLink href='/contact' target='_blank' className='bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                                <span className='text-[#00FFB2] font-bold'>ابدأ مشروعك الأن · Start Your Project</span>
                            </LocaleLink>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default EcommerceFeatures
