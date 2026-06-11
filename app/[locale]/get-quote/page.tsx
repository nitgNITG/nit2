import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ContactForm from '../components/ContactForm'
import { useTranslations } from 'next-intl'

function QuoteHeader() {
    const t = useTranslations('getQuote');
    return (
        <header className='bg-gradient-to-br from-[#0B2923] via-[#0d3329] to-[#1a4f40] text-white'>
            <div className='p-container py-10'>
                <Navbar />
                <div className='mt-16 mb-10 text-center max-w-3xl mx-auto'>
                    {/* Badge */}
                    <span className='inline-block bg-[#268F79]/30 border border-[#268F79] text-[#00FFB2] text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase'>
                        {t('badge')}
                    </span>
                    <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold leading-snug mb-4'>
                        {t('title')}
                    </h1>
                    <p className='text-white/70 text-lg md:text-xl leading-relaxed mb-8'>
                        {t('subtitle')}
                    </p>

                    {/* Trust badges */}
                    <div className='flex flex-wrap justify-center gap-6 text-sm'>
                        {['✓ free', '✓ no-obligation', '✓ reply24'].map(k => (
                            <span key={k} className='flex items-center gap-1.5 text-[#00FFB2] font-semibold'>
                                {t(k as any)}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </header>
    );
}

function WhyChooseUs() {
    const t = useTranslations('getQuote');
    const items = [
        { icon: '🎓', key: 'why1' },
        { icon: '🛒', key: 'why2' },
        { icon: '🌍', key: 'why3' },
        { icon: '⚡', key: 'why4' },
    ];
    return (
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-10'>
            {items.map(({ icon, key }) => (
                <div key={key} className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center'>
                    <div className='text-3xl mb-2'>{icon}</div>
                    <p className='text-xs font-semibold text-gray-700'>{t(key as any)}</p>
                </div>
            ))}
        </div>
    );
}

const GetQuotePage = () => {
    const t = useTranslations('getQuote');
    return (
        <div>
            <QuoteHeader />

            <section className='p-container py-12 max-w-5xl mx-auto'>
                <WhyChooseUs />

                <div className='grid grid-cols-1 lg:grid-cols-5 gap-10 items-start'>

                    {/* Left: context / services we quote for */}
                    <div className='lg:col-span-2 space-y-6'>
                        <div>
                            <h2 className='text-xl font-bold text-[#0B2923] mb-3'>{t('servicesTitle')}</h2>
                            <div className='space-y-3'>
                                {[
                                    { icon: '🎓', key: 'svc1' },
                                    { icon: '🛒', key: 'svc2' },
                                    { icon: '💻', key: 'svc3' },
                                ].map(({ icon, key }) => (
                                    <div key={key} className='flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100'>
                                        <span className='text-2xl'>{icon}</span>
                                        <div>
                                            <p className='font-semibold text-sm text-gray-800'>{t(`${key}Title` as any)}</p>
                                            <p className='text-xs text-gray-500 mt-0.5'>{t(`${key}Desc` as any)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className='bg-gradient-to-br from-[#0B2923] to-[#268F79] rounded-2xl p-6 text-white'>
                            <div className='grid grid-cols-2 gap-4 text-center'>
                                {[
                                    { num: '12+', label: t('stat1') },
                                    { num: '200+', label: t('stat2') },
                                    { num: '24h', label: t('stat3') },
                                    { num: '100%', label: t('stat4') },
                                ].map(({ num, label }) => (
                                    <div key={num}>
                                        <div className='text-2xl font-bold text-[#00FFB2]'>{num}</div>
                                        <div className='text-xs text-white/70 mt-1'>{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: the form */}
                    <div className='lg:col-span-3'>
                        <ContactForm />
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default GetQuotePage;
