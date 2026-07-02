'use client'
import axios from 'axios';
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import LoadingCard from '../../dashboard/components/LoadingCard';
import { useLocale, useTranslations } from 'next-intl';
import { cloudinaryOptimized, isCloudinaryUrl, skipOptimization } from '@/utils/cloudinaryUrl';

const Learingprojects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false)
    const t = useTranslations('projectPage')
    const locale = useLocale()

    const fetchProjects = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/project?type=lms&lang=${locale}`)
            setProjects(data.data)
            setLoading(true)
        } catch (error: any) {
            setLoading(true)
            // console.error(error);
        }
    }, [locale])

    useEffect(() => { fetchProjects() }, [fetchProjects])

    return (
        <section className='p-container py-10 lg:py-16'>
            <div className='py-5 space-y-3'>
                <p className='text-center text-sm font-semibold text-[#268F79] tracking-widest uppercase'>
                    {locale === 'ar' ? 'منصات تعليمية مباشرة' : 'Live Educational Platforms'}
                </p>
                <h2 className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center'>
                    {t('item1')}
                </h2>
                <p className='text-center text-gray-500 text-sm max-w-xl mx-auto'>
                    {locale === 'ar'
                        ? 'منصات Moodle مخصصة تعمل حالياً وتخدم آلاف المستخدمين في مصر والخليج'
                        : 'Custom Moodle LMS platforms currently live and serving thousands of users across Egypt and the Gulf'}
                </p>
            </div>
            <div className='grid grid-cols-12 gap-6 md:gap-8 mt-6'>
                {!loading
                    ? <LoadingCard number={6} />
                    : projects.map((project: any, index: number) => (
                        <div key={project.id} className='col-span-12 md:col-span-6 lg:col-span-4 flex'>
                            <div className='flex flex-col w-full border rounded-3xl overflow-hidden bg-white group hover:shadow-lg transition-shadow duration-200'>
                                {/* Fixed-height image — all cards share the same image row */}
                                <div className='overflow-hidden bg-gray-100 h-56 flex-shrink-0'>
                                    <Image
                                        src={cloudinaryOptimized(project.img, 600)}
                                        alt={locale === 'en' ? project.titleEn : project.title}
                                        unoptimized={skipOptimization(project.img)}
                                        width={600}
                                        height={400}
                                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                    />
                                </div>
                                {/* Content flex-col: title + description grow, buttons pinned to bottom */}
                                <div className='flex flex-col flex-1 px-4 pt-4 pb-5'>
                                    <h3 className='font-bold text-xl'>{locale === 'en' ? project.titleEn : project.title}</h3>
                                    <p
                                        dir={locale === 'ar' ? 'rtl' : 'ltr'}
                                        className='text-gray-500 mt-2 text-sm text-justify flex-1'
                                    >
                                        {locale === 'en' ? project.descriptionEn : project.description}
                                    </p>
                                    {project.links?.length > 0 && (
                                        <div className='flex flex-col gap-2 mt-4'>
                                            {project.links.map((l: any, i: number) => (
                                                <a
                                                    key={i}
                                                    href={l.link}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    className='w-full text-center bg-gradient-to-b from-[#268F79] to-[#0B2923] hover:opacity-90 text-[#00FFB2] px-5 py-3 rounded-md font-bold text-sm transition-opacity'
                                                >
                                                    {locale === 'en' ? l.headerEn : l.headerAr}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
        </section>
    )
}

export default Learingprojects
