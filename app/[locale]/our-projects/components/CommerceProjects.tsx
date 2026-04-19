'use client'
import axios from 'axios';
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import LoadingCard from '../../dashboard/components/LoadingCard';
import { useLocale, useTranslations } from 'next-intl';

const CommerceProjects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false)
    const t = useTranslations('projectPage')
    const locale = useLocale()

    const fetchProjects = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/project?type=app&lang=${locale}`)
            setProjects(data.data)
            setLoading(true)
        } catch (error: any) {
            setLoading(true)
            console.error(error);
        }
    }, [locale])

    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    return (
        <section className='p-container py-10'>
            <div className='py-5'>
                <h2 className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center mb-10'>
                    {t('item2')}
                </h2>
            </div>
            <div className='grid grid-cols-12 space-y-10 md:space-y-0 md:gap-10 lg:gap-20'>
                {!loading ?
                    <LoadingCard number={6} />
                    :
                    projects.map((project: any) => (
                        <div key={project.id} className='col-span-12 md:col-span-6 lg:col-span-4'>
                            <div className='space-y-5 border rounded-3xl overflow-hidden h-full'>
                                <Image
                                    src={project.img}
                                    alt={locale === 'en' ? project.titleEn : project.title}
                                    loading='lazy'
                                    width={700}
                                    height={700}
                                    className='w-full h-full'
                                />
                                <div className='pb-5 px-3'>
                                    <h5 className='font-bold text-xl uppercase'>
                                        {locale === 'en' ? project.titleEn : project.title}
                                    </h5>
                                    <p className='text-lg font-semibold'>
                                        {locale === 'en' ? project.descriptionEn : project.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
        </section>
    )
}

export default CommerceProjects
