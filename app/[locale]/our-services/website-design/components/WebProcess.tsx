import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل والاستشارة',
        titleEn: 'Discovery & Consultation',
        descAr: 'نحدد أهداف الموقع والجمهور المستهدف والصفحات المطلوبة لوضع نطاق واضح.',
        descEn: 'We define your website goals, target audience and required pages to set a clear scope.',
    },
    {
        titleAr: 'تصميم UI/UX',
        titleEn: 'UI/UX Design',
        descAr: 'نصمم واجهات الموقع بهوية بصرية جذابة وتجربة تصفّح سلسة على كل الأجهزة.',
        descEn: 'We design the website interfaces with an attractive identity and smooth browsing on all devices.',
    },
    {
        titleAr: 'التطوير والبرمجة',
        titleEn: 'Development',
        descAr: 'نبرمج الموقع بأحدث التقنيات مع نظام إدارة محتوى يتيح لك التحديث بنفسك.',
        descEn: 'We build the website with modern technologies and a CMS so you can update it yourself.',
    },
    {
        titleAr: 'تهيئة محركات البحث (SEO)',
        titleEn: 'SEO Optimization',
        descAr: 'نهيّئ الموقع تقنياً لمحركات البحث لتحسين ظهوره وسرعته على Google.',
        descEn: 'We technically optimize the site for search engines to improve its Google ranking and speed.',
    },
    {
        titleAr: 'الاختبار والإطلاق',
        titleEn: 'Testing & Launch',
        descAr: 'نختبر الموقع على المتصفحات والأجهزة المختلفة ثم نطلقه على نطاقك واستضافتك.',
        descEn: 'We test the site across browsers and devices, then launch it on your domain and hosting.',
    },
    {
        titleAr: 'الدعم والصيانة',
        titleEn: 'Support & Maintenance',
        descAr: 'نقدّم دعماً فنياً مستمراً وتحديثات وصيانة مع ضمان لمدة سنة.',
        descEn: 'We provide ongoing technical support, updates and maintenance with a 1-year warranty.',
    },
]

const WebProcess = () => {
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
                        {isAr ? 'كيف نطوّر موقعك خطوة بخطوة' : 'How We Build Your Website — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من أول استشارة حتى الإطلاق والدعم، تستغرق عادة من 3 إلى 8 أسابيع حسب حجم الموقع.'
                            : 'A clear methodology from first consultation to launch and support — typically 3 to 8 weeks depending on site size.'}
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

export default WebProcess
