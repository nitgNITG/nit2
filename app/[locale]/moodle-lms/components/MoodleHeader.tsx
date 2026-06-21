import React from 'react'
import Navbar from '../../components/Navbar'
import CountUp from '../../components/CountUp'

const MoodleHeader = () => {
    /* ── First-section background + length — toggle by swapping which line is commented ── */
    // OLD (original — header_whous.jpg + teal-tinted overlay):
    // const HEADER_CONTAINER = 'relative overflow-hidden min-h-svh lg:min-h-[77svh] flex flex-col bg-[url("/header_whous.jpg")] bg-center bg-cover bg-no-repeat p-container'
    // const HEADER_OVERLAY = 'linear-gradient(135deg, rgba(10,21,32,0.70) 0%, rgba(15,40,30,0.60) 50%, rgba(13,40,24,0.65) 100%)'
    // NEW (matches "مشروعاتنا" / our-projects — same image, overlay & length):
    const HEADER_CONTAINER = 'relative overflow-hidden min-h-svh lg:min-h-[77svh] flex flex-col bg-[url("/header_img.jpg")] bg-center bg-cover bg-no-repeat p-container'
    const HEADER_OVERLAY = 'linear-gradient(135deg, rgba(10,21,32,0.55) 0%, rgba(15,31,46,0.45) 50%, rgba(13,40,24,0.50) 100%)'

    return (
        <header>
            <div className={HEADER_CONTAINER}>

                {/* Overlay */}
                <div className='absolute inset-0' style={{ background: HEADER_OVERLAY }} />

                <div className='absolute -top-10 -right-10 w-64 h-64 opacity-20 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-2xl border-2 border-[#00FFCD]' />
                    <div className='absolute inset-6 rotate-45 rounded-xl border border-[#268F79]' />
                </div>

                <div className='absolute top-0 left-0 right-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #268F79, #00FFCD, #268F79, transparent)' }} />

                <div className='py-10 relative z-10'>
                    <Navbar />
                </div>

                <div className='flex-1 flex items-center justify-center relative z-10 pb-20'>
                    <div className='text-center space-y-6 max-w-3xl px-4'>

                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-2 border border-[#1E7D67] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#1E7D67]/10 backdrop-blur-sm'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                E-Learning · منصات تعليمية
                            </span>
                        </div>

                        <div>
                            <h1 className='text-xl md:text-2xl lg:text-3xl 2xl:text-5xl font-bold leading-tight drop-shadow-lg'>
                                <span className='text-white'>Moodle LMS</span>
                                <span className='block mt-2' style={{ color: '#00FFCD' }}>تطوير منصات التعلم</span>
                            </h1>
                        </div>

                        <p className='text-white/80 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed drop-shadow'>
                            منصات Moodle مخصصة للجامعات والمدارس والشركات — دعم عربي كامل، تطبيقات جوال، واستضافة مُدارة
                        </p>
                        <p className='text-white/60 text-sm max-w-xl mx-auto leading-relaxed'>
                            Custom Moodle platforms for universities, schools & enterprises — Arabic RTL, mobile apps, managed hosting
                        </p>

                        <div className='flex flex-wrap gap-8 justify-center pt-2'>
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={50} suffix="+" /></div>
                                <div className='text-white/70 text-sm'>منصة Moodle حية</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={2013} /></div>
                                <div className='text-white/70 text-sm'>منذ سنة</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={100} suffix="%" /></div>
                                <div className='text-white/70 text-sm'>عملاء راضون</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </header>
    )
}

export default MoodleHeader
