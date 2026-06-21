import React from 'react'
import LocaleLink from './LocaleLink'

interface TeaserProps {
    type: 'moodle' | 'ecommerce'
    locale: string
}

const MOODLE_CONTENT = {
    ar: {
        badge: 'التعليم الإلكتروني',
        title: 'منصات Moodle التعليمية',
        subtitle: 'للجامعات والشركات في مصر والخليج',
        desc: 'نطوّر منصات Moodle مخصصة بدعم عربي كامل، تطبيقات iOS وAndroid، بث مباشر، اختبارات إلكترونية وشهادات — لأكثر من 50 مؤسسة منذ 2013.',
        points: ['50+ منصة Moodle حية', 'دعم عربي RTL كامل', 'تطبيق iOS وAndroid', 'بث مباشر واختبارات'],
        cta: 'اعرف أكثر عن منصات Moodle',
        href: '/moodle-lms',
        wa: 'أريد الاستفسار عن منصة Moodle التعليمية',
        markets: ['🇪🇬 مصر', '🇸🇦 السعودية', '🇦🇪 الإمارات', '🇶🇦 قطر', '🇰🇼 الكويت'],
    },
    en: {
        badge: 'E-Learning',
        title: 'Moodle LMS Platforms',
        subtitle: 'For universities & enterprises in Egypt & the Gulf',
        desc: 'We build custom Moodle platforms with full Arabic RTL support, iOS & Android apps, live streaming, quizzes & e-certificates — 50+ live platforms since 2013.',
        points: ['50+ live Moodle platforms', 'Full Arabic RTL support', 'iOS & Android app', 'Live streaming & quizzes'],
        cta: 'Learn more about Moodle',
        href: '/moodle-lms',
        wa: 'I want to inquire about a Moodle LMS platform',
        markets: ['🇪🇬 Egypt', '🇸🇦 Saudi Arabia', '🇦🇪 UAE', '🇶🇦 Qatar', '🇰🇼 Kuwait'],
    },
}

const ECOMMERCE_CONTENT = {
    ar: {
        badge: 'التجارة الإلكترونية',
        title: 'تطبيقات التجارة الإلكترونية',
        subtitle: 'متاجر ومنصات Multivendor لمصر والخليج',
        desc: 'نبني متاجر إلكترونية وتطبيقات جوال متكاملة مع بوابات الدفع الخليجية والمصرية، شركات الشحن، ونظام Multi-vendor — مشاريع حية على Google Play وApp Store.',
        points: ['تطبيق iOS وAndroid', 'مدى / STC Pay / Fawry', 'تكامل شركات الشحن', 'Multi-vendor اختياري'],
        cta: 'اعرف أكثر عن التجارة الإلكترونية',
        href: '/ecommerce-app',
        wa: 'أريد الاستفسار عن تطوير متجر إلكتروني',
        markets: ['🇪🇬 مصر', '🇸🇦 السعودية', '🇦🇪 الإمارات', '🇶🇦 قطر', '🇴🇲 عُمان'],
    },
    en: {
        badge: 'eCommerce',
        title: 'eCommerce Applications',
        subtitle: 'Stores & Multivendor platforms for Egypt & the Gulf',
        desc: 'We build full-featured online stores and mobile apps with Gulf & Egyptian payment gateways, shipping integrations, and optional Multi-vendor — live on Google Play & App Store.',
        points: ['iOS & Android app', 'Mada / STC Pay / Fawry', 'Shipping integrations', 'Multi-vendor option'],
        cta: 'Learn more about eCommerce',
        href: '/ecommerce-app',
        wa: 'I want to inquire about eCommerce development',
        markets: ['🇪🇬 Egypt', '🇸🇦 Saudi Arabia', '🇦🇪 UAE', '🇶🇦 Qatar', '🇴🇲 Oman'],
    },
}

const WHATSAPP = '+201091568240'

const ServiceTeaser = ({ type, locale }: TeaserProps) => {
    const isAr = locale === 'ar'
    const c = type === 'moodle'
        ? (isAr ? MOODLE_CONTENT.ar : MOODLE_CONTENT.en)
        : (isAr ? ECOMMERCE_CONTENT.ar : ECOMMERCE_CONTENT.en)

    const isMoodle = type === 'moodle'
    const accentColor = isMoodle ? '#1E7D67' : '#1a6b58'

    return (
        <div className={`rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white`}>
            {/* Top color bar */}
            <div className='h-1' style={{ background: `linear-gradient(90deg, ${accentColor}, #00FFB2)` }} />

            <div className='p-6 md:p-8 space-y-5'>
                {/* Badge */}
                <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#1E7D67] border border-[#1E7D67]/30 px-3 py-1 rounded-full bg-[#1E7D67]/5'>
                    {c.badge}
                </span>

                {/* Title */}
                <div>
                    <h3 className='text-xl md:text-2xl font-bold text-[#0B2923]'>{c.title}</h3>
                    <p className='text-[#1E7D67] font-semibold text-sm mt-1'>{c.subtitle}</p>
                </div>

                {/* Description */}
                <p className='text-gray-600 text-sm leading-relaxed'>{c.desc}</p>

                {/* Feature points */}
                <div className='grid grid-cols-2 gap-2'>
                    {c.points.map((p, i) => (
                        <div key={i} className='flex items-center gap-2 text-sm text-gray-700'>
                            <span className='text-[#1E7D67] font-bold'>✓</span>
                            <span>{p}</span>
                        </div>
                    ))}
                </div>

                {/* Markets */}
                <div className='flex flex-wrap gap-2'>
                    {c.markets.map((m, i) => (
                        <span key={i} className='text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full'>{m}</span>
                    ))}
                </div>

                {/* CTAs */}
                <div className='flex gap-3 pt-2'>
                    <LocaleLink href={c.href}
                        className='flex-1 text-center bg-gradient-to-r from-[#1E7D67] to-[#0B2923] text-[#00FFB2] font-bold py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity'>
                        {c.cta}
                    </LocaleLink>
                    <a href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(c.wa)}`}
                        target='_blank' rel='noreferrer'
                        className='border border-green-500 text-green-700 font-semibold px-4 py-2.5 rounded-lg hover:bg-green-50 transition-colors text-sm flex items-center gap-1.5'>
                        💬
                    </a>
                </div>
            </div>
        </div>
    )
}

export default ServiceTeaser
