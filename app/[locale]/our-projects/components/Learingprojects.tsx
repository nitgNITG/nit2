'use client'
import axios from 'axios';
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import LoadingCard from '../../dashboard/components/LoadingCard';
import { useLocale, useTranslations } from 'next-intl';

const Learingprojects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false)
    const t = useTranslations('projectPage')
    const locale = useLocale()

    const fetchProjects = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/project?type=project&lang=${locale}`)
            setProjects(data.data)
            setLoading(true)
        } catch (error: any) {
            setLoading(true)
            console.error(error);
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
            <div className='grid grid-cols-12 gap-6 md:gap-10 mt-6'>
                {!loading
                    ? <LoadingCard number={6} />
                    : projects.map((project: any) => (
                        <div key={project.id} className='col-span-12 md:col-span-6 lg:col-span-4'>
                            <div className='space-y-4 group'>
                                <div className='overflow-hidden rounded-xl'>
                                    <Image
                                        src={project.img}
                                        alt={locale === 'en' ? project.titleEn : project.title}
                                        loading='lazy'
                                        width={700}
                                        height={700}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                    />
                                </div>
                                <div>
                                    <h3 className='font-bold text-xl'>{locale === 'en' ? project.titleEn : project.title}</h3>
                                    <p className='text-gray-500 mt-1'>{locale === 'en' ? project.descriptionEn : project.description}</p>
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
