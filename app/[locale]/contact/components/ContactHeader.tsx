import React from 'react'
import Navbar from '../../components/Navbar'
import { useTranslations, useLocale } from 'next-intl'
import CountUp from '../../components/CountUp'

const ContactHeader = () => {
    const t = useTranslations('ContactusPage');
    const locale = useLocale();
    const isAr = locale === 'ar';

    /* ═══════════ OLD first-section (original) ═══════════
       To revert: comment out the NEW return below and uncomment this block.
    return (
        <header className=''>
            <div className='bg-[url("/our_projects.jpg")] bg-[-250px] md:bg-top bg-cover bg-no-repeat min-h-svh lg:min-h-[77svh] p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
                <div className='h-full p-container relative flex justify-center'>
                    <div className='absolute lg:right-0 top-56 lg:top-10'>
                        <Logo className='size-56' />
                    </div>
                    <div className='lg:absolute top-20 left-0 lg:w-[600px]'>
                        <div className='relative flex justify-center items-center py-10 lg:py-10 px-5'>
                            <div className='w-full absolute text-white bg-white/10 py-20 rounded-lg blur-[2px] ' />
                            <div className='text-center'>
                                <h1 className='text-white font-bold text-2xl md:text-3xl'>
                                    {t('title.sub')}
                                </h1>
                                <p className='text-white font-bold text-base md:text-lg mt-3'>
                                    {t('title.main')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
    ═══════════ END OLD first-section ═══════════ */

    /* ═══════════ NEW first-section — background & length match "مشروعاتنا" / our-projects ═══════════
       To revert: comment out this return and uncomment the OLD block above. */
    return (
        <header>
            <div className='relative overflow-hidden min-h-svh lg:min-h-[77svh] flex flex-col bg-[url("/header_img.jpg")] bg-center bg-cover bg-no-repeat p-container'>

                {/* Overlay — same as our-projects */}
                <div className='absolute inset-0' style={{ background: 'linear-gradient(135deg, rgba(10,21,32,0.55) 0%, rgba(15,31,46,0.45) 50%, rgba(13,40,24,0.50) 100%)' }} />

                {/* Subtle diamond accents */}
                <div className='absolute -top-10 -right-10 w-64 h-64 opacity-20 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-2xl border-2 border-[#00FFCD]' />
                    <div className='absolute inset-6 rotate-45 rounded-xl border border-[#1E7D67]' />
                </div>
                <div className='absolute bottom-10 left-10 w-40 h-40 opacity-10 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-xl border border-[#00FFCD]' />
                </div>

                {/* Top accent line */}
                <div className='absolute top-0 left-0 right-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #1E7D67, #00FFCD, #1E7D67, transparent)' }} />

                {/* Navbar */}
                <div className='py-10 relative z-10'>
                    <Navbar />
                </div>

                {/* Hero content */}
                <div className='flex-1 flex items-center justify-center relative z-10 pb-20'>
                    <div className='text-center space-y-6 max-w-3xl px-4'>

                        {/* Badge */}
                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-2 border border-[#1E7D67] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#1E7D67]/10 backdrop-blur-sm'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                {isAr ? 'الشركة الوطنية لهندسة البرمجيات' : 'N.I.T — Egypt · Since 2013'}
                            </span>
                        </div>

                        <h1 className='text-xl md:text-2xl lg:text-3xl 2xl:text-5xl font-bold text-white leading-tight drop-shadow-lg'>
                            {t('title.sub')}
                        </h1>

                        <p className='text-white/80 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed drop-shadow'>
                            {t('title.main')}
                        </p>

                        {/* Stats */}
                        <div className='flex flex-wrap gap-8 justify-center pt-2'>
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>24/7</div>
                                <div className='text-white/70 text-sm'>{isAr ? 'دعم فني متواصل' : 'Technical Support'}</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={100} suffix="%" /></div>
                                <div className='text-white/70 text-sm'>{isAr ? 'سرعة الرد' : 'Response Rate'}</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={5} suffix="+" /></div>
                                <div className='text-white/70 text-sm'>{isAr ? 'دول عربية' : 'Countries Served'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default ContactHeader