import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل والاستشارة',
        titleEn: 'Discovery & Consultation',
        descAr: 'نحدد نوع المتجر، الفئات، طرق الدفع والشحن المطلوبة لوضع نطاق واضح للمشروع.',
        descEn: 'We define your store type, categories, and required payment and shipping methods to set a clear scope.',
    },
    {
        titleAr: 'تصميم UI/UX',
        titleEn: 'UI/UX Design',
        descAr: 'نصمم واجهات التطبيق ولوحة التحكم بتجربة استخدام سلسة تناسب عملاءك.',
        descEn: 'We design the app and dashboard interfaces with a smooth user experience tailored to your customers.',
    },
    {
        titleAr: 'تطوير التطبيق ولوحة التحكم',
        titleEn: 'App & Dashboard Development',
        descAr: 'نطوّر تطبيق iOS وAndroid واحداً باستخدام Flutter مع لوحة تحكم ويب متكاملة.',
        descEn: 'We build a single iOS & Android app using Flutter with a full web admin dashboard.',
    },
    {
        titleAr: 'تكامل الدفع والشحن',
        titleEn: 'Payment & Shipping Integration',
        descAr: 'ندمج بوابات الدفع الخليجية والمصرية وشركات الشحن لتشغيل المتجر بالكامل.',
        descEn: 'We integrate Gulf and Egyptian payment gateways and shipping providers to run the store end to end.',
    },
    {
        titleAr: 'الاختبار والنشر على المتاجر',
        titleEn: 'Testing & Store Publishing',
        descAr: 'نختبر الأداء والأمان وننشر التطبيق على Google Play وApp Store نيابة عنك.',
        descEn: 'We test performance and security and publish the app to Google Play and the App Store on your behalf.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق المتجر، ندرّب فريقك، ونقدّم دعماً فنياً مستمراً مع ضمان لمدة سنة.',
        descEn: 'We launch the store, train your team, and provide ongoing technical support with a 1-year warranty.',
    },
]

const EcommerceProcess = () => {
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
                        {isAr ? 'كيف نطوّر تطبيق متجرك خطوة بخطوة' : 'How We Build Your eCommerce App — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من أول استشارة حتى النشر على المتاجر والدعم، تستغرق عادة من 6 إلى 14 أسبوعاً حسب التعقيد.'
                            : 'A clear methodology from first consultation to store publishing and support — typically 6 to 14 weeks depending on complexity.'}
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

export default EcommerceProcess
