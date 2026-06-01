'use client'
import React from 'react'
import img from '../../assets/cost_projects.webp'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import LocaleLink from './LocaleLink'

const ProjectsCost = () => {
    const t = useTranslations('cost')
    const locale = useLocale()
    const isAr = locale === 'ar'
    return (
        <section className='py-10 p-container'>
            <div className="flex justify-center">
                <div className='text-center lg:w-11/12 space-y-4'>
                    <p className='text-[#268F79] text-lg'>{t('hint')}</p>
                    <h3 className='text-xl lg:text-2xl font-bold'>{t('title')}</h3>
                    <p className="text-lg font-semibold">
                        {t('desc')}
                    </p>
                </div>
            </div>
            <div className='pt-10 lg:pt-20'>
                <div className='flex flex-col-reverse lg:grid grid-cols-12 gap-10'>
                    <div className='col-span-12 lg:col-span-6 flex items-center'>
                        <div>
                            <h5 className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold !leading-loose mb-5'>
                                {t('more.item1')}
                            </h5>
                            <h6 className='sm:text-lg md:text-xl lg:text-xl font-bold !leading-loose mb-3'>
                                {t('more.item2')}
                            </h6>
                            <h6 className='sm:text-lg md:text-xl lg:text-xl font-bold !leading-loose'>
                                {t('more.item3')}
                            </h6>
                            <p dir={isAr ? 'rtl' : 'ltr'} className='md:text-lg font-semibold mt-5 text-justify'>
                                {t('more.desc')}
                            </p>
                            <div className='flex justify-end pt-10'>
                                <LocaleLink href={'/contact'} target='_blank' className='block bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                                    <span className='text-[#00FFB2] font-bold'>
                                        {t('btn')}
                                    </span>
                                </LocaleLink>
                            </div>
                        </div>
                    </div>
                    <div className='col-span-12 lg:col-span-6'>
                        <Image
                            src={img}
                            alt='Project Cost Estimation'
                            loading='lazy'
                            placeholder="blur"
                            quality={85}
                            width={900}
                            height={900}
                            className='w-full h-full'
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

export default ProjectsCost