import React from 'react'
import Navbar from '../../components/Navbar'
import { useTranslations } from 'next-intl'

const BuildProductHeader = () => {
    const t = useTranslations('BuildProduct')
    return (
        <header>
            <div className='relative overflow-hidden flex flex-col bg-[url("/header_img.jpg")] bg-center bg-cover bg-no-repeat p-container'>

                {/* Overlay */}
                <div
                    className='absolute inset-0'
                    style={{ background: 'linear-gradient(135deg, rgba(10,21,32,0.60) 0%, rgba(15,31,46,0.50) 50%, rgba(13,40,24,0.55) 100%)' }}
                />

                {/* Top accent line */}
                <div
                    className='absolute top-0 left-0 right-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #1E7D67, #00FFCD, #1E7D67, transparent)' }}
                />

                {/* Navbar */}
                <div className='py-10 relative z-[99]'>
                    <Navbar />
                </div>

                {/* Hero content */}
                <div className='flex-1 flex items-center justify-center relative z-10 pt-6 pb-16'>
                    <div className='text-center space-y-5 max-w-3xl px-4'>
                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-2 border border-[#1E7D67] text-[#00FFCD] text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full bg-[#1E7D67]/10 backdrop-blur-sm'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                {t('heroBadge')}
                            </span>
                        </div>

                        <h1 className='text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-bold text-white leading-tight drop-shadow-lg'>
                            {t('heroTitle')}
                        </h1>

                        <p className='text-white/80 text-base md:text-lg font-medium max-w-xl mx-auto leading-relaxed drop-shadow'>
                            {t('heroSubtitle')}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default BuildProductHeader
