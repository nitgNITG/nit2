import React from 'react'
import LocaleLink from '../../../components/LocaleLink'
import { getLocale } from 'next-intl/server'

const EG_CLIENTS = [
    { icon: '🏛️', ar: 'الجامعات والكليات المصرية', en: 'Egyptian Universities & Colleges' },
    { icon: '🏫', ar: 'المدارس الخاصة والدولية', en: 'Private & International Schools' },
    { icon: '🏢', ar: 'مراكز التدريب والتطوير', en: 'Training & Development Centers' },
    { icon: '🏗️', ar: 'الشركات الكبرى — تدريب الموظفين', en: 'Large Enterprises — Staff Training' },
    { icon: '📋', ar: 'الهيئات الحكومية المصرية', en: 'Egyptian Government Bodies' },
    { icon: '📚', ar: 'أكاديميات التعليم الإلكتروني', en: 'E-Learning Academies' },
];

const GULF_CLIENTS = [
    { icon: '🏛️', ar: 'الجامعات الخليجية والعربية', en: 'Gulf & Arab Universities' },
    { icon: '🛢️', ar: 'شركات النفط والطاقة', en: 'Oil, Gas & Energy Companies' },
    { icon: '🏦', ar: 'البنوك والمؤسسات المالية', en: 'Banks & Financial Institutions' },
    { icon: '🏥', ar: 'القطاع الصحي والمستشفيات', en: 'Healthcare & Hospitals' },
    { icon: '🏗️', ar: 'شركات المقاولات والإنشاءات', en: 'Construction & Engineering Firms' },
    { icon: '📋', ar: 'وزارات وجهات حكومية خليجية', en: 'Gulf Ministries & Government Bodies' },
];

const FEATURES_COMMON = [
    { icon: '🌐', ar: 'دعم عربي كامل RTL', en: 'Full Arabic RTL Support' },
    { icon: '📱', ar: 'تطبيق iOS وAndroid', en: 'iOS & Android App' },
    { icon: '🎥', ar: 'بث مباشر وفيديو', en: 'Live Streaming & Video' },
    { icon: '📝', ar: 'اختبارات وشهادات إلكترونية', en: 'Quizzes & E-Certificates' },
    { icon: '💳', ar: 'بوابات الدفع الخليجية والمصرية', en: 'Gulf & Egyptian Payment Gateways' },
    { icon: '🔌', ar: 'تكامل مع Zoom وMicrosoft Teams', en: 'Zoom & Microsoft Teams Integration' },
];

const MoodleMarkets = async () => {
    const isAr = (await getLocale()) === 'ar'

    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-12'>

                {/* Heading */}
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'نخدم مصر والخليج' : 'Serving Egypt & the Gulf'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr ? 'من يستفيد من منصة Moodle؟' : 'Who benefits from a Moodle platform?'}
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        {isAr ? 'سواء كنت في القاهرة أو الرياض أو دبي — لدينا منصة Moodle جاهزة لسوقك ومتطلباتك' : 'Whether you are in Cairo, Riyadh or Dubai — we have a Moodle platform ready for your market and needs'}
                    </p>
                </div>

                {/* Two columns: Egypt + Gulf */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>

                    {/* Egypt */}
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                        <div className={`bg-gradient-to-r from-[#0B2923] to-[#268F79] px-6 py-4 flex items-center gap-3 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                            <span className='text-3xl'>🇪🇬</span>
                            <div className={isAr ? 'text-right w-full' : 'text-left w-full'}>
                                <h3 className='text-white font-bold text-lg'>{isAr ? 'السوق المصري' : 'Egypt Market'}</h3>
                            </div>
                        </div>
                        <div className='p-6 space-y-3'>
                            {EG_CLIENTS.map((c, i) => (
                                <div key={i} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                                    <span className='text-xl'>{c.icon}</span>
                                    <div className={isAr ? 'text-right' : 'text-left'}>
                                        <p className='font-semibold text-sm text-[#0B2923]' dir={isAr ? 'rtl' : 'ltr'}>{isAr ? c.ar : c.en}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gulf */}
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                        <div className={`bg-gradient-to-r from-[#0B2923] to-[#1a6b58] px-6 py-4 flex items-center gap-3 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                            <span className='text-3xl'>🌍</span>
                            <div className={isAr ? 'text-right w-full' : 'text-left w-full'}>
                                <h3 className='text-white font-bold text-lg'>{isAr ? 'دول الخليج العربي' : 'Arab Gulf Countries'}</h3>
                                <p className='text-[#00FFB2] text-xs'>{isAr ? 'السعودية · الإمارات · قطر · الكويت · البحرين · عُمان' : 'Saudi Arabia · UAE · Qatar · Kuwait · Bahrain · Oman'}</p>
                            </div>
                        </div>
                        <div className='p-6 space-y-3'>
                            {GULF_CLIENTS.map((c, i) => (
                                <div key={i} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                                    <span className='text-xl'>{c.icon}</span>
                                    <div className={isAr ? 'text-right' : 'text-left'}>
                                        <p className='font-semibold text-sm text-[#0B2923]' dir={isAr ? 'rtl' : 'ltr'}>{isAr ? c.ar : c.en}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Common features strip */}
                <div className='bg-[#0B2923] rounded-2xl p-6 md:p-8'>
                    <h3 className='text-white font-bold text-center text-lg mb-6'>{isAr ? 'كل منصة تشمل بالأساس' : 'Every platform basically includes'}</h3>
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                        {FEATURES_COMMON.map((f, i) => (
                            <div key={i} className={`flex items-center gap-2 ${isAr ? 'flex-row' : 'flex-row-reverse justify-end'}`}>
                                <span className='text-xl'>{f.icon}</span>
                                <span className='text-[#00FFB2] text-sm font-medium' dir={isAr ? 'rtl' : 'ltr'}>{isAr ? f.ar : f.en}</span>
                            </div>
                        ))}
                    </div>
                    <div className='flex justify-center mt-8'>
                        <LocaleLink href='/contact'
                            className='bg-[#00FFB2] text-[#0B2923] font-bold px-8 py-3 rounded-lg hover:bg-[#00e6a0] transition-colors'>
                            {isAr ? 'احجز استشارة مجانية — 30 دقيقة' : 'Book a free consultation — 30 minutes'}
                        </LocaleLink>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default MoodleMarkets
