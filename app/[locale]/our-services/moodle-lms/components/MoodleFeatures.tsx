import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'Custom Moodle Setup & Configuration',
        titleAr: 'إعداد وتكوين Moodle المخصص',
        desc: 'Full Moodle installation, theming, plugin configuration, and branding to match your organization identity.',
        descAr: 'تركيب Moodle الكامل، التصميم، إعداد الإضافات والهوية البصرية لمؤسستك.',
    },
    {
        id: 2,
        title: 'Course & Content Development',
        titleAr: 'تطوير المقررات والمحتوى',
        desc: 'SCORM-compatible course building, quizzes, assignments, video embedding, and interactive learning paths.',
        descAr: 'بناء مقررات متوافقة مع SCORM، اختبارات، واجبات، تضمين فيديو، ومسارات تعليمية تفاعلية.',
    },
    {
        id: 3,
        title: 'Multi-Language & RTL Support',
        titleAr: 'دعم متعدد اللغات والكتابة من اليمين',
        desc: 'Full Arabic RTL support and bilingual platforms for Egyptian, Gulf, and international clients.',
        descAr: 'دعم كامل للعربية RTL ومنصات ثنائية اللغة لعملاء مصر والخليج والعالم.',
    },
    {
        id: 4,
        title: 'Mobile App Integration',
        titleAr: 'تكامل تطبيق الجوال',
        desc: 'Native Moodle mobile apps on Google Play & App Store with push notifications and offline access.',
        descAr: 'تطبيقات Moodle للجوال على Google Play وApp Store مع إشعارات وصول دون إنترنت.',
    },
    {
        id: 5,
        title: 'Hosting, Maintenance & Support',
        titleAr: 'الاستضافة والصيانة والدعم',
        desc: 'Managed cloud hosting, regular updates, backups, and 24/7 technical support for your live LMS.',
        descAr: 'استضافة سحابية مُدارة، تحديثات دورية، نسخ احتياطي، ودعم فني على مدار الساعة لمنصتك.',
    },
]

const MoodleFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt='Moodle LMS Development'
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
                                {isAr ? 'Moodle LMS · منصات تعليمية' : 'Moodle LMS · E-Learning'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <>تطوير منصات <span className='text-darkAquaMint'>Moodle</span></>
                                            : <>Moodle <span className='text-darkAquaMint'>LMS</span> Development</>}
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
                            <LocaleLink href='/contact' target='_blank' className='bg-gradient-to-r from-[#1E7D67] to-[#0B2923] px-5 py-3 rounded-md'>
                                <span className='text-[#00FFB2] font-bold'>{isAr ? 'ابدأ مشروعك الآن' : 'Start Your Project'}</span>
                            </LocaleLink>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default MoodleFeatures
