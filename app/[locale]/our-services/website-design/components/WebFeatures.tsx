import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'Corporate & Business Websites',
        titleAr: 'مواقع الشركات والأعمال',
        desc: 'Professional company websites that present your brand, services and identity with a modern design.',
        descAr: 'مواقع شركات احترافية تعرض علامتك التجارية وخدماتك وهويتك بتصميم عصري.',
    },
    {
        id: 2,
        title: 'Responsive & Mobile-First',
        titleAr: 'متجاوب مع كل الشاشات',
        desc: 'Websites that look and work perfectly on mobile, tablet and desktop with full Arabic RTL support.',
        descAr: 'مواقع تظهر وتعمل بشكل مثالي على الجوال والتابلت والكمبيوتر مع دعم عربي كامل (RTL).',
    },
    {
        id: 3,
        title: 'SEO-Optimized',
        titleAr: 'مهيأ لمحركات البحث',
        desc: 'Built following SEO best practices to rank on Google and bring you real organic traffic.',
        descAr: 'مبني وفق أفضل ممارسات SEO ليتصدر نتائج Google ويجلب لك زيارات حقيقية.',
    },
    {
        id: 4,
        title: 'CMS & Self-Editing',
        titleAr: 'نظام إدارة محتوى',
        desc: 'An easy content management system so you can update text, images and pages yourself.',
        descAr: 'نظام إدارة محتوى سهل يتيح لك تعديل النصوص والصور والصفحات بنفسك.',
    },
    {
        id: 5,
        title: 'Custom Web Apps & Dashboards',
        titleAr: 'تطبيقات ويب ولوحات تحكم',
        desc: 'Custom web applications, booking systems and dashboards tailored to your business needs.',
        descAr: 'تطبيقات ويب وأنظمة حجز ولوحات تحكم مخصصة حسب احتياج نشاطك.',
    },
]

const WebFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='Website Design & Development'
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
                                {isAr ? 'تصميم المواقع' : 'Web · Design & Development'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-start' : 'justify-end flex-row-reverse')}>
                                {isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />}
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <div className='m-4'>تصميم مواقع <span className='text-darkAquaMint'>الإنترنت</span></div>
                                            : <div className='m-4'>Website <span className='text-darkAquaMint'>Design</span></div>}
                                    </h2>
                                </div>
                                {!isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />}
                            </div>
                        </div>
                        <ul>
                            {features.map((feature, i) => (
                                <li
                                    key={feature.id}
                                    className={clsx('px-10 py-3', { 'bg-white rounded-xl': i === 0 })}
                                >
                                    <div className='flex items-center gap-3 justify-start flex-row-reverse'>
                                        <div className={clsx('flex flex-1 min-w-0 flex-col gap-1', isAr ? 'items-end' : 'items-start')}>
                                            <h3 className={clsx('text-base font-bold w-10/12', isAr ? 'text-right' : 'text-left')}>{isAr ? feature.titleAr : feature.title}</h3>
                                            <p className={clsx('text-sm text-gray-500 lg:w-10/12', isAr ? 'text-right' : 'text-left')}>{isAr ? feature.descAr : feature.desc}</p>
                                        </div>
                                        <div className='text-[88px] leading-none bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c] flex-shrink-0 w-16 text-center'>{i + 1}</div>
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

export default WebFeatures
