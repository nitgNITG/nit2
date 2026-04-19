import React from 'react'
import Navbar from '../../components/Navbar'
import { useLocale, useTranslations } from 'next-intl'

const OurProjectsHeader = () => {
    const t = useTranslations('projectPage')
    const locale = useLocale()

    return (
        <header>
            <div
                className='relative overflow-hidden min-h-svh lg:min-h-[77svh] p-container flex flex-col'
                style={{ background: 'linear-gradient(135deg, #0A1520 0%, #0F1F2E 55%, #0D2818 100%)' }}
            >
                {/* Geometric diamond — top right */}
                <div className='absolute -top-16 -right-16 w-80 h-80 opacity-50 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-2xl' style={{ background: 'linear-gradient(135deg, #0F1922, #268F79)' }} />
                    <div className='absolute inset-4 rotate-45 rounded-xl border border-[#00FFCD] opacity-30' />
                    <div className='absolute inset-10 rotate-45 rounded-lg border border-[#268F79] opacity-20' />
                </div>

                {/* Geometric diamond — bottom left */}
                <div className='absolute -bottom-20 -left-16 w-72 h-72 opacity-30 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-2xl' style={{ background: 'linear-gradient(135deg, #0F1922, #268F79)' }} />
                    <div className='absolute inset-4 rotate-45 rounded-xl border border-[#00FFCD] opacity-40' />
                </div>

                {/* Small accent diamonds */}
                <div className='absolute top-1/3 right-1/4 w-20 h-20 opacity-15 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-md border border-[#268F79]' />
                </div>
                <div className='absolute bottom-1/4 right-1/3 w-12 h-12 opacity-10 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded border border-[#00FFCD]' />
                </div>

                {/* Subtle grid overlay */}
                <div className='absolute inset-0 opacity-[0.03] pointer-events-none'
                    style={{ backgroundImage: 'linear-gradient(#00FFCD 1px, transparent 1px), linear-gradient(90deg, #00FFCD 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                {/* Top accent line */}
                <div className='absolute top-0 left-0 right-0 h-[2px]'
                    style={{ background: 'linear-gradient(90deg, transparent, #268F79, #00FFCD, #268F79, transparent)' }} />

                {/* Navbar */}
                <div className='py-10 relative z-10'>
                    <Navbar />
                </div>

                {/* Hero content */}
                <div className='flex-1 flex items-center justify-center relative z-10 pb-20'>
                    <div className='text-center space-y-6 max-w-3xl px-4'>

                        {/* Eyebrow */}
                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-2 border border-[#268F79] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#268F79]/10'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD]' style={{ animation: 'pulse 2s infinite' }} />
                                {locale === 'ar' ? 'الشركة الوطنية لهندسة البرمجيات' : 'N.I.T — Egypt · Since 2013'}
                            </span>
                        </div>

                        {/* Main H1 */}
                        <div>
                            {locale === 'ar' ? (
                                <>
                                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight'>
                                        مشاريعنا البرمجية
                                    </h1>
                                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mt-2' style={{ color: '#00FFCD' }}>
                                        والتصميمية
                                    </h1>
                                </>
                            ) : (
                                <>
                                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight'>
                                        Our Software &amp;
                                    </h1>
                                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mt-2' style={{ color: '#00FFCD' }}>
                                        Design Projects
                                    </h1>
                                </>
                            )}
                        </div>

                        {/* Subtitle */}
                        <p className='text-white/60 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed'>
                            {locale === 'ar'
                                ? 'منصات Moodle التعليمية · تطبيقات التجارة الإلكترونية · حلول برمجية متكاملة لمصر والخليج'
                                : 'Moodle LMS Platforms · eCommerce Apps · Custom Software for Egypt & Gulf Markets'}
                        </p>

                        {/* Stats row */}
                        <div className='flex flex-wrap gap-6 justify-center pt-2'>
                            <div className='text-center'>
                                <div className='text-3xl font-bold' style={{ color: '#00FFCD' }}>100+</div>
                                <div className='text-white/50 text-sm'>{locale === 'ar' ? 'مشروع ناجح' : 'Successful Projects'}</div>
                            </div>
                            <div className='w-px bg-white/10 self-stretch' />
                            <div className='text-center'>
                                <div className='text-3xl font-bold' style={{ color: '#00FFCD' }}>15+</div>
                                <div className='text-white/50 text-sm'>{locale === 'ar' ? 'سنة خبرة' : 'Years Experience'}</div>
                            </div>
                            <div className='w-px bg-white/10 self-stretch' />
                            <div className='text-center'>
                                <div className='text-3xl font-bold' style={{ color: '#00FFCD' }}>90+</div>
                                <div className='text-white/50 text-sm'>{locale === 'ar' ? 'عميل راضٍ' : 'Happy Clients'}</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </header>
    )
}

export default OurProjectsHeader
