import React from 'react'
import LocaleLink from './LocaleLink'

const cards = [
    {
        num: '01',
        titleEn: 'Moodle LMS Development',
        titleAr: 'تطوير منصات Moodle التعليمية',
        descEn: 'Custom Moodle platforms for universities, schools & corporates. Arabic RTL, mobile apps, SCORM, and full hosting.',
        descAr: 'منصات Moodle مخصصة للجامعات والمدارس والمؤسسات. دعم عربي، تطبيقات جوال، SCORM واستضافة كاملة.',
        href: '/moodle-lms',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '02',
        titleEn: 'eCommerce App Development',
        titleAr: 'تطوير تطبيقات التجارة الإلكترونية',
        descEn: 'Mobile shopping apps live on Google Play & App Store. Multivendor, single-store, POS & payment integration.',
        descAr: 'تطبيقات تسوق حية على Google Play وApp Store. متعدد البائعين، متاجر فردية، نقاط بيع وتكامل الدفع.',
        href: '/ecommerce-app',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
    {
        num: '03',
        titleEn: 'Blog & Content for Leads',
        titleAr: 'مدونة ومحتوى لجذب العملاء',
        descEn: 'Read our expert articles on Moodle LMS, eCommerce development, and digital transformation in Egypt & Gulf.',
        descAr: 'اقرأ مقالاتنا المتخصصة في Moodle وتطوير التجارة الإلكترونية والتحول الرقمي في مصر والخليج.',
        href: '/blog',
        color: 'from-[#1E7D67] to-[#0B2923]',
    },
]

const ServiceCards = () => {
    return (
        <section className='bg-[#0F1922] p-container py-14 lg:py-20'>
            {/* Section header */}
            <div className='flex flex-col items-end gap-3 mb-10'>
                <p className='text-[#00FFB2]/70 text-sm font-semibold'>خدماتنا المتخصصة · Our Specialized Services</p>
                <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                    <div className='z-10'>
                        <h2 className='text-2xl md:text-3xl font-bold text-white text-shadow'>
                            What We <span className='text-aquaMint'>Build</span> Best
                        </h2>
                    </div>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-[#0F1922]' />
                </div>
            </div>

            {/* Cards grid */}
            <div className='grid grid-cols-12 gap-5'>
                {cards.map((card, i) => (
                    <div key={card.num} className={`col-span-12 ${i === 0 ? 'md:col-span-12 lg:col-span-5' : i === 1 ? 'md:col-span-6 lg:col-span-4' : 'md:col-span-6 lg:col-span-3'}`}>
                        <LocaleLink
                            href={card.href}
                            className='group relative block h-full bg-white/5 border border-white/10 rounded-xl p-7 hover:bg-white/10 hover:border-[#00FFB2]/30 transition-all duration-200 overflow-hidden'
                        >
                            {/* Number watermark */}
                            <div aria-hidden='true' className='absolute -top-3 -right-3 text-[80px] font-black text-white/5 leading-none select-none'>
                                {card.num}
                            </div>

                            {/* Accent line */}
                            <div className={`w-10 h-1 rounded-full bg-gradient-to-r ${card.color} mb-5`} />

                            <div className='space-y-2 mb-4'>
                                <h3 className='text-white font-bold text-xl text-right leading-snug'>{card.titleAr}</h3>
                                <h3 className='text-white/60 font-semibold text-base text-left leading-snug'>{card.titleEn}</h3>
                            </div>

                            <div className='space-y-1 mb-6'>
                                <p className='text-white/50 text-sm text-right leading-relaxed'>{card.descAr}</p>
                                <p className='text-white/60 text-sm text-left leading-relaxed'>{card.descEn}</p>
                            </div>

                            <div className='flex items-center justify-between'>
                                <span className='text-[#00FFB2] text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                                    Learn more →
                                </span>
                                <span className='text-[#00FFB2] text-sm font-bold flex items-center gap-1'>
                                    اكتشف المزيد
                                    <span className='inline-block group-hover:-translate-x-1 transition-transform duration-200'>←</span>
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
