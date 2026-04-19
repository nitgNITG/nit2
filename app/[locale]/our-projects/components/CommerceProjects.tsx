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

    useEffect(() => { fetchProjects() }, [fetchProjects])

    return (
        <section className='bg-[#F2F3FA] p-container py-10 lg:py-16'>
            <div className='py-5 space-y-3'>
                <p className='text-center text-sm font-semibold text-[#268F79] tracking-widest uppercase'>
                    {locale === 'ar' ? 'تطبيقات حية على المتاجر' : 'Live on Google Play & App Store'}
                </p>
                <h2 className='text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center'>
                    {t('item2')}
                </h2>
                <p className='text-center text-gray-500 text-sm max-w-xl mx-auto'>
                    {locale === 'ar'
                        ? 'تطبيقات تجارة إلكترونية متكاملة تعمل على iOS وAndroid مع نظام دفع ومخزون كامل'
                        : 'Full-featured eCommerce apps running on iOS and Android with payment gateway and inventory management'}
                </p>
            </div>
            <div className='grid grid-cols-12 gap-6 md:gap-10 mt-6'>
                {!loading
                    ? <LoadingCard number={6} />
                    : projects.map((project: any) => (
                        <div key={project.id} className='col-span-12 md:col-span-6 lg:col-span-4'>
                            <div className='space-y-4 border rounded-3xl overflow-hidden h-full bg-white group hover:shadow-lg transition-shadow duration-200'>
                                <div className='overflow-hidden'>
                                    <Image
                                        src={project.img}
                                        alt={locale === 'en' ? project.titleEn : project.title}
                                        loading='lazy'
                                        width={700}
                                        height={700}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                    />
                                </div>
                                <div className='pb-5 px-4'>
                                    <h3 className='font-bold text-xl'>{locale === 'en' ? project.titleEn : project.title}</h3>
                                    <p className='text-gray-500 mt-1'>{locale === 'en' ? project.descriptionEn : project.description}</p>
                                    <div className='flex gap-2 mt-3'>
                                        <span className='text-xs bg-[#0F1922] text-[#00FFCD] px-2 py-1 rounded font-medium'>Google Play</span>
                                        <span className='text-xs bg-[#0F1922] text-[#00FFCD] px-2 py-1 rounded font-medium'>App Store</span>
                                    </div>
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
