import Image from 'next/image'
import React from 'react'
import img from '../../../assets/footer_logo.webp'
import SocialMedia from '../../components/SocialMedia'
import { useTranslations } from 'next-intl'

const WhyUs = () => {
    const t = useTranslations('whous.whyus')
    return (
        <section className='p-container py-20'>
            <div className='flex flex-col-reverse lg:grid grid-cols-12 space-y-10 lg:space-y-0 lg:gap-20'>
                <div className='col-span-12 lg:col-span-6 flex items-center justify-end'>
                    <div className='space-y-10 lg:space-y-16'>
                        <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                            <div className='z-10'>
                                <h2 className='text-2xl md:text-3xl font-bold text-shadow '>
                                    {t('title')}
                                </h2>
                            </div>
                            <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                        </div>
                        <div className='space-y-5 lg:space-y-10'>
                            <p className='font-bold'>
                                {t('item1')}
                            </p>
                            <p className='font-bold'>
                                {t('item2')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
                    <div className='w-full lg:px-10 py-5 relative'>
                        <Image
                            src={img}
                            alt=''
                            width={1000}
                            height={1000}
                            className='w-full h-full'
                        />
                        <div className='absolute top-0 right-0'>
                            <SocialMedia />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default WhyUs