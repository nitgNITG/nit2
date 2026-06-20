import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل والاستشارة',
        titleEn: 'Discovery & Consultation',
        descAr: 'نحدد أهداف المؤسسة، عدد المستخدمين، والمتطلبات التعليمية لوضع نطاق واضح للمشروع.',
        descEn: 'We define your institution goals, user count, and learning requirements to set a clear project scope.',
    },
    {
        titleAr: 'التصميم والتخطيط',
        titleEn: 'Design & Planning',
        descAr: 'نصمم هوية المنصة وتجربة المستخدم ونخطط بنية المقررات والصلاحيات والإضافات المطلوبة.',
        descEn: 'We design the platform identity and UX, and plan the course structure, roles, and required plugins.',
    },
    {
        titleAr: 'الإعداد والتطوير',
        titleEn: 'Setup & Development',
        descAr: 'نركّب Moodle، نطبّق التصميم، ونطوّر الإضافات والتكاملات مع دعم عربي RTL كامل.',
        descEn: 'We install Moodle, apply the theme, and develop plugins and integrations with full Arabic RTL support.',
    },
    {
        titleAr: 'المحتوى والتعريب',
        titleEn: 'Content & Localization',
        descAr: 'نرفع المقررات، نضبط الاختبارات والشهادات، ونكمل تعريب الواجهة بالكامل.',
        descEn: 'We upload courses, configure quizzes and certificates, and complete the full interface localization.',
    },
    {
        titleAr: 'الاختبار والمراجعة',
        titleEn: 'Testing & QA',
        descAr: 'نختبر الأداء والأمان وتجربة المستخدم على مختلف الأجهزة قبل الإطلاق.',
        descEn: 'We test performance, security, and user experience across devices before launch.',
    },
    {
        titleAr: 'الإطلاق والدعم',
        titleEn: 'Launch & Support',
        descAr: 'نطلق المنصة، ندرّب فريقك، ونقدّم دعماً فنياً مستمراً مع ضمان لمدة سنة.',
        descEn: 'We launch the platform, train your team, and provide ongoing technical support with a 1-year warranty.',
    },
]

const MoodleProcess = () => {
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
                        {isAr ? 'كيف نطوّر منصة Moodle خطوة بخطوة' : 'How We Build Your Moodle Platform — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من أول استشارة حتى الإطلاق والدعم، تستغرق عادة من 4 إلى 10 أسابيع حسب حجم المشروع.'
                            : 'A clear methodology from first consultation to launch and support — typically 4 to 10 weeks depending on project size.'}
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

export default MoodleProcess
