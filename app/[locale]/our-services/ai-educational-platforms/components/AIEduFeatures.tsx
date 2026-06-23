import React from 'react'
import { getLocale } from 'next-intl/server'
import Image from 'next/image'
import service from '../../../../assets/services.webp'
import clsx from 'clsx'
import LocaleLink from '../../../components/LocaleLink'

const features = [
    {
        id: 1,
        title: 'Smart Learning Paths',
        titleAr: 'مسارات تعلم ذكية',
        desc: 'AI algorithms that adapt the curriculum to each student’s pace and performance.',
        descAr: 'خوارزميات ذكاء اصطناعي تكيف المنهج حسب سرعة وأداء كل طالب.',
    },
    {
        id: 2,
        title: 'AI Virtual Assistants',
        titleAr: 'مساعدين افتراضيين بالذكاء الاصطناعي',
        desc: 'Chatbots available 24/7 to answer student questions and provide tutoring.',
        descAr: 'روبوتات محادثة متوفرة على مدار الساعة للإجابة على أسئلة الطلاب وتقديم الدعم.',
    },
    {
        id: 3,
        title: 'Predictive Analytics',
        titleAr: 'تحليلات تنبؤية',
        desc: 'Identify at-risk students early with machine learning models that analyze grades and engagement.',
        descAr: 'تحديد الطلاب المعرضين للتأخر دراسياً مبكراً باستخدام نماذج تعلم الآلة.',
    },
    {
        id: 4,
        title: 'Automated Grading',
        titleAr: 'تصحيح آلي',
        desc: 'AI-powered grading for essays and complex assignments to save educators time.',
        descAr: 'تصحيح آلي مدعوم بالذكاء الاصطناعي للمقالات والواجبات المعقدة لتوفير وقت المعلمين.',
    },
    {
        id: 5,
        title: 'Content Personalization',
        titleAr: 'تخصيص المحتوى',
        desc: 'Dynamically generated quizzes and study materials based on individual learning gaps.',
        descAr: 'إنشاء اختبارات ومواد دراسية ديناميكياً بناءً على فجوات التعلم الفردية.',
    },
]

const AIEduFeatures = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section dir={isAr ? 'rtl' : 'ltr'} className='bg-[#F2F3FA] py-10 p-container'>
            <div className='grid grid-cols-12 space-y-10'>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full lg:order-last'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt={isAr ? 'منصات تعليم بالذكاء الاصطناعي' : 'AI Educational Platforms'}
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
                                {isAr ? 'AI · منصات تعليمية' : 'AI · Educational Platforms'}
                            </p>
                            <div className={clsx('flex -space-x-5 lg:-space-x-8 items-center', isAr ? 'justify-end' : 'justify-start flex-row-reverse')}>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {isAr
                                            ? <>منصات تعليم <span className='text-darkAquaMint'>بالذكاء الاصطناعي</span></>
                                            : <>AI <span className='text-darkAquaMint'>Educational</span> Platforms</>}
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

export default AIEduFeatures
