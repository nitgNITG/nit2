import React from 'react'
import { getLocale } from 'next-intl/server'
import LocaleLink from './LocaleLink'

const cards = [
    {
        num: '01',
        titleEn: 'Moodle LMS Development',
        titleAr: 'تطوير منصات Moodle التعليمية',
        descEn: 'Custom Moodle platforms for universities, schools & corporates. Arabic RTL, mobile apps, SCORM, and full hosting.',
        descAr: 'منصات Moodle مخصصة للجامعات والمدارس والمؤسسات. دعم عربي، تطبيقات جوال، SCORM واستضافة كاملة.',
        href: '/our-services/moodle-lms',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '02',
        titleEn: 'eCommerce App Development',
        titleAr: 'تطوير تطبيقات التجارة الإلكترونية',
        descEn: 'Mobile shopping apps live on Google Play & App Store. Multivendor, single-store, POS & payment integration.',
        descAr: 'تطبيقات تسوق حية على Google Play وApp Store. متعدد البائعين، متاجر فردية، نقاط بيع وتكامل الدفع.',
        href: '/our-services/ecommerce-app',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '03',
        titleEn: 'Delivery App Development',
        titleAr: 'تطوير تطبيقات التوصيل',
        descEn: 'On-demand delivery apps like Mrsool & HungerStation — customer & driver apps with live GPS tracking.',
        descAr: 'تطبيقات توصيل مثل مرسول وهنقرستيشن — تطبيق عميل وسائق مع تتبع مباشر بالخريطة.',
        href: '/our-services/delivery-app',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '04',
        titleEn: 'Restaurant App Development',
        titleAr: 'تطوير تطبيقات المطاعم',
        descEn: 'Branded restaurant ordering & delivery apps with digital menus, POS and multi-branch management.',
        descAr: 'تطبيقات طلب ودليفري باسم مطعمك مع قائمة رقمية، نقاط بيع وإدارة فروع.',
        href: '/our-services/restaurant-app',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '05',
        titleEn: 'Loyalty & Rewards Systems',
        titleAr: 'أنظمة الولاء والنقاط',
        descEn: 'Customer loyalty apps with points, coupons, digital cards and a CRM analytics dashboard.',
        descAr: 'تطبيقات ولاء العملاء بالنقاط والكوبونات والبطاقات الرقمية ولوحة تحليلات.',
        href: '/our-services/loyalty-app',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '06',
        titleEn: 'Blog & Content for Leads',
        titleAr: 'مدونة ومحتوى لجذب العملاء',
        descEn: 'Read our expert articles on LMS, eCommerce, delivery & loyalty app development in Egypt & Gulf.',
        descAr: 'اقرأ مقالاتنا المتخصصة في المنصات والتجارة الإلكترونية والتوصيل وأنظمة الولاء في مصر والخليج.',
        href: '/blog',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
]

const ServiceCards = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section className='bg-[#0F1922] p-container py-14 lg:py-20'>
            {/* Section header */}
            <div className={`flex flex-col gap-3 mb-10 ${isAr ? 'items-end' : 'items-start'}`}>
                <p className='text-[#00FFB2]/70 text-sm font-semibold w-full'>{isAr ? 'خدماتنا المتخصصة' : 'Our Specialized Services'}</p>
                <div className={`flex -space-x-5 lg:-space-x-8 items-center w-full ${isAr ? 'justify-start' : 'justify-end flex-row-reverse'}`}>
                    {isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-[#0F1922]' />}
                    <div className='z-10'>
                        <h2 className='text-2xl md:text-3xl font-bold text-white text-shadow'>
                            {isAr
                                ? <div className='mx-4'>أفضل ما <span className='text-aquaMint'>نبنيه</span></div>
                                : <div className='mx-4'>What We <span className='text-aquaMint'>Build</span> Best</div>}
                        </h2>
                    </div>
                    {!isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-[#0F1922]' />}
                </div>
            </div>

            {/* Cards grid */}
            <div className='grid grid-cols-12 gap-5'>
                {cards.map((card) => (
                    <div key={card.num} className='col-span-12 md:col-span-6 lg:col-span-4'>
                        <LocaleLink
                            href={card.href}
                            className='group relative block h-full bg-white/5 border border-white/10 rounded-xl p-7 hover:bg-white/10 hover:border-[#00FFB2]/30 transition-all duration-200 overflow-hidden'
                        >
                            {/* Number watermark */}
                            <div aria-hidden='true' className={`absolute -top-3 text-[80px] font-black text-white/5 leading-none select-none ${isAr ? '-right-3' : '-left-3'}`}>
                                {card.num}
                            </div>

                            {/* Accent line */}
                            <div className={`w-10 h-1 rounded-full bg-gradient-to-r ${card.color} mb-5 ${isAr ? 'ml-auto' : ''}`} />

                            <div className='mb-4'>
                                <h3 className={`text-white font-bold text-xl leading-snug ${isAr ? 'text-right' : 'text-left'}`}>
                                    {isAr ? card.titleAr : card.titleEn}
                                </h3>
                            </div>

                            <div className='mb-6'>
                                <p className={`text-white/60 text-sm leading-relaxed ${isAr ? 'text-right' : 'text-left'}`}>
                                    {isAr ? card.descAr : card.descEn}
                                </p>
                            </div>

                            <div className={`flex items-center ${isAr ? 'justify-end' : 'justify-start'}`}>
                                <span className='text-[#00FFB2] text-sm font-bold flex items-center gap-1'>
                                    {isAr
                                        ? <>اكتشف المزيد<span className='inline-block group-hover:-translate-x-1 transition-transform duration-200'>←</span></>
                                        : <>Learn more<span className='inline-block group-hover:translate-x-1 transition-transform duration-200'>→</span></>}
                                </span>
                            </div>
                        </LocaleLink>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default ServiceCards
