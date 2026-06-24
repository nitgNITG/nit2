import React from 'react'
import { getLocale } from 'next-intl/server'
import Navbar from '../../../components/Navbar'
import CountUp from '../../../components/CountUp'

const IosHeader = async () => {
    const isAr = (await getLocale()) === 'ar'

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
                <div className='absolute bottom-20 right-20 w-32 h-32 opacity-10 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-lg border border-[#00FFCD]' />
                </div>

                <div className='absolute top-0 left-0 right-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #268F79, #00FFCD, #268F79, transparent)' }} />

                <div className='py-10 relative z-[99]'>
                    <Navbar />
                </div>

                <div className='flex-1 flex items-center justify-center relative z-10 pb-20'>
                    <div className='text-center space-y-6 max-w-3xl px-4'>

                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-2 border border-[#268F79] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#268F79]/10 backdrop-blur-sm'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                {isAr ? 'تطبيقات الآيفون' : 'iPhone Apps'}
                            </span>
                        </div>

                        <div>
                            <h1 className='text-xl md:text-2xl lg:text-3xl 2xl:text-5xl font-bold leading-tight drop-shadow-lg'>
                                <span className='text-white'>iOS</span>
                                <span className='block mt-2' style={{ color: '#00FFCD' }}>
                                    {isAr ? 'تصميم تطبيقات الآيفون' : 'App Development'}
                                </span>
                            </h1>
                        </div>

                        <p className='text-white/80 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed drop-shadow'>
                            {isAr
                                ? 'شركة تطوير وبرمجة تطبيقات آيفون احترافية على App Store — تطبيقات بـ Flutter وفق معايير Apple وتجربة استخدام راقية'
                                : 'Professional iPhone app development on the App Store — Flutter apps following Apple guidelines with a premium experience'}
                        </p>

                        <div className='flex flex-wrap gap-8 justify-center pt-2'>
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>Flutter</div>
                                <div className='text-white/70 text-sm'>{isAr ? 'تقنية التطوير' : 'Framework'}</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}>App Store</div>
                                <div className='text-white/70 text-sm'>{isAr ? 'نشر على المتجر' : 'Store Publishing'}</div>
                            </div>
                            <div className='w-px bg-white/20 self-stretch' />
                            <div className='text-center'>
                                <div className='text-lg md:text-xl 2xl:text-2xl font-bold drop-shadow' style={{ color: '#00FFCD' }}><CountUp end={50} suffix="+" /></div>
                                <div className='text-white/70 text-sm'>{isAr ? 'تطبيق ناجح' : 'Successful apps'}</div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </header>
    )
}

export default IosHeader
