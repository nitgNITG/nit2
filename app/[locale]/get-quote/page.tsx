import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ContactForm from '../components/ContactForm'
import { useTranslations } from 'next-intl'

const GetQuotePage = () => {
    const t = useTranslations('getQuote');

    const trustBadges = [t('trust1'), t('trust2'), t('trust3')];

    const services = [
        { icon: '🎓', title: t('svc1Title'), desc: t('svc1Desc') },
        { icon: '🛒', title: t('svc2Title'), desc: t('svc2Desc') },
        { icon: '💻', title: t('svc3Title'), desc: t('svc3Desc') },
    ];

    const stats = [
        { num: '12+', label: t('stat1') },
        { num: '150+', label: t('stat2') },
        { num: '24h', label: t('stat3') },
        { num: '100%', label: t('stat4') },
    ];

    return (
        <div>
            {/* ── Header ───────────────────────────────────────────── */}
            <header className='bg-gradient-to-br from-[#0B2923] via-[#0d3329] to-[#1a4f40] text-white'>
                <div className='p-container'>
                    <div className='py-10'>
                        <Navbar />
                    </div>
                    <div className='pb-14 text-center max-w-3xl mx-auto'>
                        {/* Badge */}
                        <span className='inline-block bg-[#268F79]/30 border border-[#268F79] text-[#00FFB2] text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase'>
                            {t('badge')}
                        </span>
                        <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold leading-snug mb-4'>
                            {t('title')}
                        </h1>
                        <p className='text-white/70 text-lg leading-relaxed mb-8'>
                            {t('subtitle')}
                        </p>
                        {/* Trust badges */}
                        <div className='flex flex-wrap justify-center gap-6 text-sm'>
                            {trustBadges.map((badge, i) => (
                                <span key={i} className='text-[#00FFB2] font-semibold'>{badge}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Why Choose Us ─────────────────────────────────────── */}
            <section className='p-container py-10 max-w-5xl mx-auto'>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-12'>
                    {[
                        { icon: '🎓', label: t('why1') },
                        { icon: '🛒', label: t('why2') },
                        { icon: '🌍', label: t('why3') },
                        { icon: '⚡', label: t('why4') },
                    ].map(({ icon, label }) => (
                        <div key={label} className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center'>
                            <div className='text-3xl mb-2'>{icon}</div>
                            <p className='text-xs font-semibold text-gray-700'>{label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Main grid: services info + form ─────────────────── */}
                <div className='grid grid-cols-1 lg:grid-cols-5 gap-10 items-start'>

                    {/* Left panel */}
                    <div className='lg:col-span-2 space-y-6'>
                        <div>
                            <h2 className='text-xl font-bold text-[#0B2923] mb-3'>{t('servicesTitle')}</h2>
                            <div className='space-y-3'>
                                {services.map(({ icon, title, desc }) => (
                                    <div key={title} className='flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100'>
                                        <span className='text-2xl'>{icon}</span>
                                        <div>
                                            <p className='font-semibold text-sm text-gray-800'>{title}</p>
                                            <p className='text-xs text-gray-500 mt-0.5'>{desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stats card */}
                        <div className='bg-gradient-to-br from-[#0B2923] to-[#268F79] rounded-2xl p-6 text-white'>
                            <div className='grid grid-cols-2 gap-4 text-center'>
                                {stats.map(({ num, label }) => (
                                    <div key={num}>
                                        <div className='text-2xl font-bold text-[#00FFB2]'>{num}</div>
                                        <div className='text-xs text-white/70 mt-1'>{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Form */}
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
