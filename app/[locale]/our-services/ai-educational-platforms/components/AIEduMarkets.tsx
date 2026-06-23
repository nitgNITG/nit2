import React from 'react'
import LocaleLink from '../../../components/LocaleLink'
import { getLocale } from 'next-intl/server'

const AUDIENCE = [
    { icon: '🧠', ar: 'الجامعات المتقدمة', en: 'Advanced Universities' },
    { icon: '💻', ar: 'شركات التكنولوجيا التعليمية (EdTech)', en: 'EdTech Companies' },
    { icon: '📈', ar: 'مراكز التدريب المهني', en: 'Professional Training Centers' },
    { icon: '🌐', ar: 'المنصات التعليمية العالمية', en: 'Global Learning Platforms' },
    { icon: '📊', ar: 'المؤسسات البحثية', en: 'Research Institutions' },
    { icon: '🤖', ar: 'مدارس المستقبل الذكية', en: 'Smart Schools of the Future' },
]

const AIEduMarkets = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-10'>
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'نخدم مصر والخليج' : 'Serving Egypt & the Gulf'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr ? 'من يستفيد من منصات الذكاء الاصطناعي؟' : 'Who benefits from AI educational platforms?'}
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        {isAr ? 'نوفر حلول الذكاء الاصطناعي التعليمية للمؤسسات التي تسعى لريادة المستقبل' : 'We provide AI educational solutions for institutions aiming to lead the future'}
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

export default AIEduMarkets
