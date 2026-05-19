'use client'
import axios from 'axios'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import { cloudinaryOptimized, cloudinaryBlurUrl } from '@/utils/cloudinaryUrl'

const Platforms = () => {
    const t = useTranslations('app')
    const [platforms, setPlatforms] = useState([])
    const locale = useLocale();
    const fetchPlatforms = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/project?type=ecommerce&important=true&lang=${locale}`)
                setPlatforms(data.data)
            } catch (error: any) {
                return { error: error.message, data: null }
            }
        }, [locale]
    )
    useEffect(() => {
        fetchPlatforms()
    }, [fetchPlatforms])

    return (
        <section className='bg-[#F2F3FA] p-container py-10'>
            <div className="flex justify-center">
                <div className='text-center lg:w-11/12 space-y-4'>
                    <p className='text-[#268F79] text-lg'>{t('hint')}</p>
                    <h3 className='text-xl lg:text-3xl font-bold'>{t('title')}</h3>
                    <p className="text-lg">
                        {t('desc')}
                    </p>
                </div>
            </div>
            <div className='pt-10'>
                <div className='grid grid-cols-12 space-y-10 md:space-y-0 md:gap-10 lg:gap-14'>
                    {
                        platforms.map((platform: any) => (
                            <div key={platform.id} className='col-span-12 md:col-span-6 lg:col-span-4'>
                                <div className='space-y-2'>
                                    <div className='bg-gray-100 rounded-lg overflow-hidden'>
                                        <Image
                                            src={cloudinaryOptimized(platform.img, 700)}
                                            alt={locale === 'en' ? platform.titleEn : platform.title}
                                            placeholder='blur'
                                            blurDataURL={cloudinaryBlurUrl(platform.img)}
                                            loading='lazy'
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            width={700}
                                            height={700}
                                            className='w-full h-full'
                                        />
                                    </div>
                                    <div className='text-center'>
                                        <h6 className='text-lg font-bold'>{locale == 'en' ? platform.titleEn : platform.title}</h6>
                                        <p dir={locale === 'ar' ? 'rtl' : 'ltr'} className='text-justify'>{locale == 'en' ? platform.descriptionEn : platform.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </section>
    )
}

export default Platforms