import React from 'react'
import ServiceTeaser from './ServiceTeaser'
import { getLocale } from 'next-intl/server'

const HomepageServices = async () => {
    const locale = await getLocale()
    const isAr = locale === 'ar'

    return (
        <section className='py-16 bg-gray-50' id='services-landing'>
            <div className='p-container space-y-10'>

                {/* Section header */}
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'تخصصاتنا' : 'Our Specializations'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr
                            ? 'حلول برمجية لمصر والخليج'
                            : 'Software Solutions for Egypt & the Gulf'}
                    </h2>
                    <p className='text-gray-500 max-w-lg mx-auto text-sm'>
                        {isAr
                            ? 'نتخصص في نوعين من المشاريع الكبيرة — منصات التعليم الإلكتروني وتطبيقات التجارة الإلكترونية'
                            : 'We specialize in two high-impact project types — e-learning platforms and eCommerce applications'}
                    </p>
                </div>

                {/* Two service cards */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8'>
                    <ServiceTeaser type='moodle' locale={locale} />
                    <ServiceTeaser type='ecommerce' locale={locale} />
                </div>

                {/* Bottom trust strip */}
                <div className='bg-[#0B2923] rounded-2xl p-6 flex flex-wrap justify-center gap-8 text-center'>
                    {[
                        { num: '50+', label: isAr ? 'منصة Moodle حية' : 'Live Moodle Platforms' },
                        { num: '2013', label: isAr ? 'منذ سنة' : 'Since' },
                        { num: '150+', label: isAr ? 'مشروع مُسلَّم' : 'Projects Delivered' },
                        { num: '100%', label: isAr ? 'عملاء راضون' : 'Satisfied Clients' },
                    ].map((s, i) => (
                        <div key={i}>
                            <div className='text-2xl font-bold text-[#00FFB2]'>{s.num}</div>
                            <div className='text-white/70 text-xs mt-1'>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default HomepageServices
