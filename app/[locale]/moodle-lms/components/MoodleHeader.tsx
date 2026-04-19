import React from 'react'
import Navbar from '../../components/Navbar'

const MoodleHeader = () => {
    return (
        <header>
            <div className='relative overflow-hidden min-h-svh lg:min-h-[77svh] flex flex-col bg-[url("/header_whous.jpg")] bg-center bg-cover bg-no-repeat p-container'>

                {/* Overlay — teal-tinted */}
                <div className='absolute inset-0' style={{ background: 'linear-gradient(135deg, rgba(10,21,32,0.70) 0%, rgba(15,40,30,0.60) 50%, rgba(13,40,24,0.65) 100%)' }} />

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
                            <span className='inline-flex items-center gap-2 border border-[#268F79] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#268F79]/10 backdrop-blur-sm'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                E-Learning · منصات تعليمية
                            </span>
                        </div>

                        <div>
                            <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight drop-shadow-lg'>
                                Moodle LMS
                            </h1>
                            <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mt-2 drop-shadow-lg' style={{ color: '#00FFCD' }}>
                                تطوير منصات التعلم
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
                                <div className='text-3xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>50+</div>
                                <div className='text-white/70 text-sm'>منصة Moodle حية</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-3xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>2013</div>
                                <div className='text-white/70 text-sm'>منذ سنة</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-3xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>100%</div>
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
