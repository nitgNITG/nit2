import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل وتحديد نوع الخدمة',
        titleEn: 'Discovery & Service Scope',
        descAr: 'نحدد نوع التوصيل، المناطق، نموذج العمولة وطرق الدفع لوضع نطاق واضح.',
        descEn: 'We define delivery type, zones, commission model and payment methods for a clear scope.',
    },
    {
        titleAr: 'تصميم تجربة العميل والسائق',
        titleEn: 'Customer & Driver UX',
        descAr: 'نصمم واجهات العميل والسائق ولوحة التحكم بتجربة سلسة وسريعة.',
        descEn: 'We design customer, driver and admin interfaces with a smooth, fast experience.',
    },
    {
        titleAr: 'تطوير التطبيقات الثلاثة',
        titleEn: 'Building the 3 Apps',
        descAr: 'نطوّر تطبيق العميل والسائق ولوحة التحكم باستخدام Flutter وخريطة مباشرة.',
        descEn: 'We build the customer app, driver app and admin dashboard with Flutter and live maps.',
    },
    {
        titleAr: 'تكامل الخرائط والدفع',
        titleEn: 'Maps & Payment Integration',
        descAr: 'ندمج خرائط جوجل، بوابات الدفع الخليجية والمصرية، ومحافظ السائقين.',
        descEn: 'We integrate Google Maps, Gulf & Egyptian payment gateways, and driver wallets.',
    },
    {
        titleAr: 'الاختبار والنشر على المتاجر',
        titleEn: 'Testing & Store Publishing',
        descAr: 'نختبر الأداء والتتبع وننشر التطبيقات على Google Play وApp Store.',
        descEn: 'We test performance and tracking, then publish to Google Play and the App Store.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق الخدمة، ندرّب فريقك، ونقدّم دعماً فنياً مع ضمان سنة.',
        descEn: 'We launch, train your team, and provide technical support with a 1-year warranty.',
    },
]

const DeliveryProcess = () => {
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
                        {isAr ? 'كيف نطوّر تطبيق التوصيل خطوة بخطوة' : 'How We Build Your Delivery App — Step by Step'}
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

export default DeliveryProcess
