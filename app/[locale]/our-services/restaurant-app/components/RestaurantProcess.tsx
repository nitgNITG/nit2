import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل وبناء القائمة',
        titleEn: 'Discovery & Menu Modeling',
        descAr: 'نحدد الفروع، نوع الخدمة، وهيكل القائمة والإضافات.',
        descEn: 'We define branches, service types, and the menu & modifier structure.',
    },
    {
        titleAr: 'تصميم تطبيق وهوية المطعم',
        titleEn: 'Brand & App Design',
        descAr: 'نصمم التطبيق بهوية مطعمك وتجربة طلب سريعة.',
        descEn: 'We design the app around your brand with a fast ordering experience.',
    },
    {
        titleAr: 'تطوير التطبيق ونظام الإدارة',
        titleEn: 'App & Management System',
        descAr: 'نطوّر تطبيق العملاء، شاشة المطبخ، ونقاط البيع.',
        descEn: 'We build the customer app, kitchen display, and POS.',
    },
    {
        titleAr: 'تكامل الدفع والتوصيل',
        titleEn: 'Payment & Delivery Integration',
        descAr: 'ندمج بوابات الدفع وخيارات التوصيل أو أسطولك الخاص.',
        descEn: 'We integrate payment gateways and delivery options or your own fleet.',
    },
    {
        titleAr: 'الاختبار والنشر على المتاجر',
        titleEn: 'Testing & Store Publishing',
        descAr: 'نختبر وننشر التطبيق على Google Play وApp Store.',
        descEn: 'We test and publish to Google Play and the App Store.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق ونُدرّب فريق المطعم مع دعم وضمان سنة.',
        descEn: 'We launch and train your restaurant team with a 1-year warranty.',
    },
]

const RestaurantProcess = () => {
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
                        {isAr ? 'كيف نطوّر تطبيق مطعمك خطوة بخطوة' : 'How We Build Your Restaurant App — Step by Step'}
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

export default RestaurantProcess
