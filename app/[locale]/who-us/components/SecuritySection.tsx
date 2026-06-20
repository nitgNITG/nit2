import React from 'react'
import img from '../../../assets/security.jpg'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

const SecuritySection = () => {
    const t = useTranslations('whous.security')
    return (
        <section className='bg-black w-full relative flex items-center h-52 lg:h-56'>
            <div className='absolute right-0 h-full'>
                <Image
                    src={img}
                    alt='أمان وحماية البيانات في مشاريع البرمجيات'
                    height={400}
                    width={400}
                    className='h-full object-contain'
                />
            </div>
            <div className='w-full h-full text-center flex justify-center items-center p-container'>
                <div className='z-10'>
                    <h3 className='text-xl md:text-2xl lg:text-3xl text-white font-bold stroke-1 stroke-black'>
                        {t('title')}
                    </h3>
                    <h4 className='text-lg md:text-xl lg:text-2xl text-white font-semibold stroke-1 stroke-black'>
                        {t('desc')}
                    </h4>
                </div>
            </div>
        </section>
    )
}

export default SecuritySection