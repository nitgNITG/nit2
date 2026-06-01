import React from 'react'
import Image from 'next/image'
import service from '../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../components/LocaleLink'

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

const MoodleFeatures = () => {
    return (
        <section className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
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
                <div className='col-span-12 lg:col-span-6'>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <p className='text-sm text-gray-500'>Moodle LMS · E-Learning · منصات تعليمية</p>
                            <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        Moodle <span className='text-aquaMint'>LMS</span> Development
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

export default MoodleFeatures
