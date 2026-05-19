'use client'
// import { projects } from '@/data/projects'
import axios from 'axios'
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import Marquee from 'react-fast-marquee'
import LocaleLink from './LocaleLink'
import { useLocale, useTranslations } from 'next-intl'
import { cloudinaryOptimized, cloudinaryBlurUrl } from '@/utils/cloudinaryUrl'

const Projects = () => {
    const t = useTranslations('Navbar')
    const [projects, setprojects] = useState([])
    const locale = useLocale()
    const fetchprojects = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/project?lang=${locale}`)
                setprojects(data.data)
            } catch (error: any) {
                return { error: error.message, data: null }
            }
        }, [locale]
    )
    useEffect(() => {
        fetchprojects()
    }, [fetchprojects])

    return (
        <section className='p-container pb-10'>
            <div dir='ltr'>
                <Marquee pauseOnHover direction='right' className='hide-scrollbar'>
                    {
                        projects.map((project: any) => {
                            return (
                                <div
                                    key={project.id}
                                    className='w-[90vw] md:w-[60vw] lg:w-[calc(100vw/3)]'
                                >
                                    <div className='space-y-5 px-5 sm:px-10 md:px-14 lg:px-20'>
                                        <div className='bg-gray-100 rounded-lg overflow-hidden'>
                                            <Image
                                                src={cloudinaryOptimized(project.img, 700)}
                                                alt={locale == 'en' ? project.titleEn : project.title}
                                                placeholder='blur'
                                                blurDataURL={cloudinaryBlurUrl(project.img)}
                                                loading='lazy'
                                                sizes="(max-width: 768px) 90vw, 33vw"
                                                width={700}
                                                height={700}
                                                className='w-full h-full'
                                            />
                                        </div>
                                        <div>
                                            <h5 className='font-bold text-lg uppercase'>{locale == 'en' ? project.titleEn : project.title}</h5>
                                            <p dir={locale === 'ar' ? 'rtl' : 'ltr'} className='font-semibold text-justify'>{locale == 'en' ? project.descriptionEn : project.description}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    }
                </Marquee>
                <div className='flex justify-center pt-14'>
                    <LocaleLink href={'/contact'} target='_blank' className='hidden lg:block bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                        <span className='text-[#00FFB2] font-bold'>
                            {t('btn')}
                        </span>
                    </LocaleLink>
                </div>
            </div>
        </section>
    )
}

export default Projects