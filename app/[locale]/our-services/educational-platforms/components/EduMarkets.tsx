import React from 'react'
import LocaleLink from '../../../components/LocaleLink'
import { getLocale } from 'next-intl/server'

const AUDIENCE = [
    { icon: '🏛️', ar: 'الجامعات والكليات', en: 'Universities & Colleges' },
    { icon: '🏫', ar: 'المدارس الخاصة والدولية', en: 'Private & International Schools' },
    { icon: '🏢', ar: 'مراكز التدريب والتطوير', en: 'Training & Development Centers' },
    { icon: '🏗️', ar: 'الشركات الكبرى — تدريب الموظفين', en: 'Large Enterprises — Staff Training' },
    { icon: '📋', ar: 'الهيئات الحكومية', en: 'Government Bodies' },
    { icon: '📚', ar: 'أكاديميات التعليم الإلكتروني', en: 'E-Learning Academies' },
]

const EduMarkets = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-10'>
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'نخدم مصر والخليج' : 'Serving Egypt & the Gulf'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr ? 'من يحتاج منصة تعليمية؟' : 'Who needs an educational platform?'}
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        {isAr ? 'سواء كنت جامعة أو مدرسة أو شركة — نبني منصتك التعليمية المخصصة' : 'Whether you are a university, school or enterprise — we build your custom educational platform'}
                    </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                    {AUDIENCE.map((a, i) => (
                        <div key={i} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                            <span className='text-3xl flex-shrink-0'>{a.icon}</span>
                            <div className={isAr ? 'text-right' : 'text-left'}>
                                <p className='font-bold text-sm text-[#0B2923]' dir={isAr ? 'rtl' : 'ltr'}>{isAr ? a.ar : a.en}</p>
                                <p className='text-xs text-gray-400'>{isAr ? a.en : a.ar}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className='flex justify-center'>
                    <LocaleLink href='/contact'
                        className='bg-[#00FFB2] text-[#0B2923] font-bold px-8 py-3 rounded-lg hover:bg-[#00e6a0] transition-colors'>
                        {isAr ? 'احجز استشارة مجانية — 30 دقيقة' : 'Book a free consultation — 30 minutes'}
                    </LocaleLink>
                </div>
            </div>
        </section>
    )
}

export default EduMarkets
