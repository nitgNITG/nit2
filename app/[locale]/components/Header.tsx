import React from 'react'
import Navbar from './Navbar'
import hero from '../../assets/header_hero.webp'
import Image from 'next/image'
import HeaderHint from './HeaderHint'
import { useTranslations } from 'next-intl'
import LocaleLink from './LocaleLink'

const Header = () => {
    const t = useTranslations('Header');
    return (
        <header className=''>
            <div className='relative min-h-svh p-container overflow-hidden'>
                {/* Background — preloaded by Next.js, served as WebP/AVIF */}
                <Image
                    src="/header_img.jpg"
                    alt=""
                    fill
                    priority
                    quality={75}
                    sizes="100vw"
                    className="object-cover object-center -z-10"
                    aria-hidden="true"
                />
                <div className='relative z-10 py-10'>
                    <Navbar />
                </div>
                <div className='relative z-10 pb-96 sm:pb-52 md:pb-32'>
                    <div className='grid grid-cols-12 space-y-10 '>
                        <div className='col-span-12 lg:col-span-6 '>
                            <div className='w-full lg:px-10 py-5'>
                                <Image
                                    src={hero}
                                    alt='NIT Software Engineering Hero'
                                    priority
                                    placeholder="blur"
                                    quality={75}
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                    width={1000}
                                    height={1000}
                                    className='w-full h-full'
                                />
                            </div>
                        </div>
                        <div className='col-span-12 lg:col-span-6 '>
                            <div className='space-y-10'>
                                <h1 className='space-y-5'>
                                    <span className='block text-white font-bold text-2xl md:text-3xl lg:text-4xl '>
                                        {t('title.one')}
                                    </span>
                                    <span className='block text-white font-bold text-2xl md:text-3xl lg:text-4xl '>
                                        {t('title.two')}
                                    </span>
                                </h1>
                                <div className='space-y-5'>
                                    <span className='block text-white font-semibold text-xl md:text-2xl lg:text-3xl'>
                                        {t('subTitle.start')}<span className='text-[#00FFB2]'> {t('subTitle.heroword')}</span>
                                    </span>
                                    <span className='block text-[#00FFB2] font-semibold text-xl md:text-2xl lg:text-3xl'>
                                        {t('subTitle.end')}
                                    </span>
                                </div>
                                <div className='flex flex-wrap gap-3 justify-end'>
                                    {/* Primary CTA — get quote */}
                                    <LocaleLink href={'/get-quote'} className='block w-fit bg-gradient-to-b from-[#268F79] to-[#0B2923] px-5 py-3.5 rounded-md hover:opacity-90 transition-opacity'>
                                        <span className='text-[#00FFB2] font-bold text-sm md:text-base'>
                                            {t('btn')}
                                        </span>
                                    </LocaleLink>
                                    {/* Secondary CTA — WhatsApp */}
                                    <a
                                        href='https://wa.me/201091568240?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D9%8A'
                                        target='_blank'
                                        rel='noreferrer'
                                        className='block w-fit border-2 border-green-400 px-5 py-3.5 rounded-md hover:bg-green-400/10 transition-colors'
                                    >
                                        <span className='text-green-400 font-bold text-sm md:text-base flex items-center gap-2'>
                                            💬 {t('btnWa')}
                                        </span>
                                    </a>
                                </div>
                                <div className='text-lg lg:text-xl font-semibold flex gap-5 lg:gap-20 justify-end'>
                                    <span className='flex justify-end'>
                                        <span className='text-white'>
                                            {t('delProject')}
                                        </span>
                                        <span className='text-white'>
                                            <span className='text-[#00FFB2] font-bold'>&#160;150+</span>
                                        </span>
                                    </span>
                                    <span className='flex justify-end'>
                                        <span className='text-white'>
                                            {t('happyClients')}
                                        </span>
                                        <span className='text-white'>
                                            <span className='text-[#00FFB2] font-bold'>&#160;100%</span>
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className='relative z-10 flex items-center'>
                <div className='absolute w-full p-container'>
                    <HeaderHint />
                </div>
            </div>
        </header>
    )
}

export default Header