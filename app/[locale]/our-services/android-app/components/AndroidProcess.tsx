import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل والاستشارة',
        titleEn: 'Discovery & Consultation',
        descAr: 'نحدد فكرة التطبيق والمميزات والجمهور المستهدف لوضع نطاق واضح للمشروع.',
        descEn: 'We define your app idea, features and target audience to set a clear project scope.',
    },
    {
        titleAr: 'تصميم UI/UX',
        titleEn: 'UI/UX Design',
        descAr: 'نصمم واجهات التطبيق وفق معايير Material Design بتجربة استخدام سلسة.',
        descEn: 'We design the app interfaces following Material Design with a smooth user experience.',
    },
    {
        titleAr: 'تطوير التطبيق',
        titleEn: 'App Development',
        descAr: 'نطوّر التطبيق بـ Flutter مع ربطه بالـ API ولوحة التحكم.',
        descEn: 'We build the app with Flutter, wiring it to the API and admin dashboard.',
    },
    {
        titleAr: 'الاختبار وضمان الجودة',
        titleEn: 'Testing & QA',
        descAr: 'نختبر الأداء والأمان على أجهزة أندرويد مختلفة لضمان استقرار التطبيق.',
        descEn: 'We test performance and security on multiple Android devices to ensure stability.',
    },
    {
        titleAr: 'النشر على Google Play',
        titleEn: 'Google Play Publishing',
        descAr: 'ننشر التطبيق على Google Play ونحسّن صفحة المتجر نيابة عنك.',
        descEn: 'We publish the app to Google Play and optimize the store listing on your behalf.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق التطبيق، ندرّب فريقك، ونقدّم دعماً فنياً مستمراً مع ضمان لمدة سنة.',
        descEn: 'We launch the app, train your team, and provide ongoing support with a 1-year warranty.',
    },
]

const AndroidProcess = () => {
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
                        {isAr ? 'كيف نطوّر تطبيق الأندرويد خطوة بخطوة' : 'How We Build Your Android App — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من أول استشارة حتى النشر على Google Play والدعم، تستغرق عادة من 6 إلى 14 أسبوعاً حسب التعقيد.'
                            : 'A clear methodology from first consultation to Google Play publishing and support — typically 6 to 14 weeks depending on complexity.'}
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

export default AndroidProcess
