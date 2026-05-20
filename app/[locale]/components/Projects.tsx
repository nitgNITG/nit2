'use client'
// import { projects } from '@/data/projects'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import Marquee from 'react-fast-marquee'
import LocaleLink from './LocaleLink'
import { useLocale, useTranslations } from 'next-intl'
import { cloudinaryOptimized, isCloudinaryUrl } from '@/utils/cloudinaryUrl'

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
                <Marquee pauseOnHover direction='right' className='hide-scrollbar items-stretch'>
                    {
                        projects.map((project: any) => {
                            const title = locale === 'en' ? project.titleEn : project.title
                            const desc = locale === 'en' ? project.descriptionEn : project.description
                            return (
                                <div
                                    key={project.id}
                                    className='w-[85vw] md:w-[50vw] lg:w-[calc(100vw/3.2)] px-3 py-2'
                                >
                                    <div className='flex flex-col bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-200'>
                                        {/* Image — plain img for guaranteed height constraint */}
                                        <div style={{ height: '208px', flexShrink: 0, overflow: 'hidden', background: '#f3f4f6' }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={cloudinaryOptimized(project.img, 700)}
                                                alt={title}
                                                loading='lazy'
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                            />
                                        </div>
                                        {/* Text */}
                                        <div className='px-5 py-4'>
                                            <h5 className='font-bold text-base uppercase line-clamp-1 mb-2'>{title}</h5>
                                            <p
                                                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                                                className='text-gray-500 text-sm text-justify line-clamp-3'
                                            >
                                                {desc}
                                            </p>
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