import React from 'react'
import { useLocale } from 'next-intl'

const steps = [
    {
        titleAr: 'التحليل وتحديد حالات الاستخدام',
        titleEn: 'Discovery & AI Use-Cases',
        descAr: 'نحدد أهدافك التعليمية وحالات استخدام الذكاء الاصطناعي الأنسب (تخصيص، مساعدون، تحليلات).',
        descEn: 'We define your learning goals and the best AI use-cases (personalization, assistants, analytics).',
    },
    {
        titleAr: 'تجهيز البيانات والنماذج',
        titleEn: 'Data & Model Selection',
        descAr: 'نجهّز ونؤمّن بيانات التعلم ونختار نماذج الذكاء الاصطناعي المناسبة لكل ميزة.',
        descEn: 'We prepare and secure learning data and select the right AI models for each feature.',
    },
    {
        titleAr: 'التصميم والتخطيط',
        titleEn: 'Design & Planning',
        descAr: 'نصمم تجربة المستخدم وبنية المنصة ونخطط تدفقات الذكاء الاصطناعي والصلاحيات.',
        descEn: 'We design the UX and platform architecture and plan the AI flows and roles.',
    },
    {
        titleAr: 'التطوير والتكامل',
        titleEn: 'Development & Integration',
        descAr: 'نطوّر المنصة، ندمج المساعدين والتوصيات والتصحيح الآلي، مع دعم عربي RTL كامل.',
        descEn: 'We build the platform and integrate assistants, recommendations and auto-grading with full Arabic RTL support.',
    },
    {
        titleAr: 'التدريب والاختبار',
        titleEn: 'Training & QA',
        descAr: 'ندرّب النماذج، نضبط دقتها، ونختبر الأداء والأمان وتجربة المستخدم قبل الإطلاق.',
        descEn: 'We train the models, tune their accuracy, and test performance, security and UX before launch.',
    },
    {
        titleAr: 'الإطلاق والتحسين المستمر',
        titleEn: 'Launch & Continuous Improvement',
        descAr: 'نطلق المنصة، ندرّب فريقك، ونحسّن النماذج باستمرار مع دعم فني وضمان لمدة سنة.',
        descEn: 'We launch the platform, train your team, and keep improving the models with ongoing support and a 1-year warranty.',
    },
]

const AIEduProcess = () => {
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
                        {isAr ? 'كيف نبني منصة تعليم بالذكاء الاصطناعي خطوة بخطوة' : 'How We Build Your AI Educational Platform — Step by Step'}
                    </h2>
                    <p className='text-gray-500 text-sm max-w-2xl mx-auto'>
                        {isAr
                            ? 'منهجية واضحة من تحديد حالات استخدام الذكاء الاصطناعي حتى الإطلاق والتحسين المستمر.'
                            : 'A clear methodology from defining AI use-cases to launch and continuous improvement.'}
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

export default AIEduProcess
