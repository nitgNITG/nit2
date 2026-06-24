import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'iOS Apps with Flutter',
        titleAr: 'تطبيقات آيفون بـ Flutter',
        desc: 'Smooth, fast iOS apps built with Flutter from a single codebase that runs on iOS & Android.',
        descAr: 'تطبيقات آيفون سريعة وسلسة مبنية بـ Flutter بكود واحد يعمل على iOS وأندرويد.',
    },
    {
        id: 2,
        title: 'Apple Human Interface Design',
        titleAr: 'تصميم وفق معايير Apple',
        desc: 'Elegant interfaces following Apple\'s Human Interface Guidelines with full Arabic RTL support.',
        descAr: 'واجهات أنيقة تتبع معايير Apple للتصميم (HIG) مع دعم عربي كامل (RTL).',
    },
    {
        id: 3,
        title: 'App Store Publishing',
        titleAr: 'النشر على App Store',
        desc: 'We manage the full submission, Apple review and App Store publishing process for you.',
        descAr: 'ندير عملية الرفع والمراجعة من Apple والنشر على App Store بالكامل نيابة عنك.',
    },
    {
        id: 4,
        title: 'Apple Pay & Ecosystem',
        titleAr: 'Apple Pay وتكامل أبل',
        desc: 'Apple Pay, push notifications, Sign in with Apple and Apple ecosystem integrations.',
        descAr: 'تكامل Apple Pay والإشعارات وتسجيل الدخول عبر Apple ومنظومة أبل.',
    },
    {
        id: 5,
        title: 'Performance & Security',
        titleAr: 'الأداء والأمان',
        desc: 'Fast, secure apps optimized for iPhone and iPad with protected user data.',
        descAr: 'تطبيقات سريعة وآمنة محسّنة للآيفون والآيباد مع حماية بيانات المستخدم.',
    },
]

const IosFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='iPhone App Development'
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
                                {isAr ? 'تطبيقات الآيفون' : 'iOS · Mobile Apps'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-start' : 'justify-end flex-row-reverse')}>
                                {isAr && <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />}
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <div className='m-4'>تصميم تطبيقات <span className='text-darkAquaMint'>الآيفون</span></div>
                                            : <div className='m-4'>iPhone <span className='text-darkAquaMint'>App</span> Development</div>}
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

export default IosFeatures
