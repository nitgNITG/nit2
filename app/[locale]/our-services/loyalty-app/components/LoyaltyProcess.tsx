import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'تصميم نموذج الولاء',
        titleEn: 'Loyalty Model Design',
        descAr: 'نحدد قواعد كسب النقاط، المستويات والمكافآت المناسبة لنشاطك.',
        descEn: 'We define earning rules, tiers and rewards that fit your business.',
    },
    {
        titleAr: 'تصميم تجربة المستخدم',
        titleEn: 'UX Design',
        descAr: 'نصمم تطبيق العميل ولوحة الإدارة بتجربة بسيطة ومحفّزة.',
        descEn: 'We design the customer app and admin dashboard with a simple, motivating UX.',
    },
    {
        titleAr: 'تطوير التطبيق والمحرك',
        titleEn: 'App & Engine Development',
        descAr: 'نطوّر التطبيق ومحرك النقاط والكوبونات ولوحة التحكم.',
        descEn: 'We build the app, the points/coupons engine, and the dashboard.',
    },
    {
        titleAr: 'التكامل مع نقاط البيع',
        titleEn: 'POS Integration',
        descAr: 'نربط النظام بنقاط البيع أو متجرك الإلكتروني لاحتساب النقاط تلقائياً.',
        descEn: 'We connect to your POS or online store so points are earned automatically.',
    },
    {
        titleAr: 'الاختبار والنشر',
        titleEn: 'Testing & Publishing',
        descAr: 'نختبر وننشر التطبيق على Google Play وApp Store.',
        descEn: 'We test and publish to Google Play and the App Store.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق البرنامج، ندرّب فريقك، ونقدّم دعماً مع ضمان سنة.',
        descEn: 'We launch the program, train your team, and support it with a 1-year warranty.',
    },
]

const LoyaltyProcess = () => {
    const locale = useLocale()
    const isAr = locale === 'ar'

    return (
        <section className='py-16 bg-[#F2F3FA]'>
            <div className='p-container space-y-10'>
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'مراحل التنفيذ' : 'Implementation Process'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr ? 'كيف نبني نظام الولاء خطوة بخطوة' : 'How We Build Your Loyalty System — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من أول استشارة حتى النشر والدعم، تستغرق عادة من 6 إلى 14 أسبوعاً حسب التعقيد.'
                            : 'A clear methodology from first consultation to launch and support — typically 6 to 14 weeks depending on complexity.'}
                    </p>
                </div>

                <ol className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                    {steps.map((step, i) => (
                        <li
                            key={step.titleEn}
                            className='relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-2'
                        >
                            <span className='text-5xl font-bold leading-none bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c]'>
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <h3 className='text-lg font-bold text-[#0B2923]'>
                                {isAr ? step.titleAr : step.titleEn}
                            </h3>
                            <p className='text-sm text-gray-500 leading-relaxed'>
                                {isAr ? step.descAr : step.descEn}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}

export default LoyaltyProcess
