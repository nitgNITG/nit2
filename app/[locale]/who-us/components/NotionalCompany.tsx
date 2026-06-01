import React from 'react'
import img from '../../../assets/whouscompany.webp'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
const NotionalCompany = () => {
    const t = useTranslations('whous.notional')
    const items = [
        t('items.item1'),
        t('items.item2'),
        t('items.item3'),
        t('items.item4'),
        t('items.item5'),
        t('items.item6'),
    ]
    return (
        <section className='p-container py-10 lg:py-20'>
            <div className='grid grid-cols-12 space-y-10 '>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={img}
                            alt=''
                            width={1000}
                            height={1000}
                            className='w-full h-full'
                        />
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6'>
                    <div className='space-y-10'>
                        <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                            <div className='z-10'>
                                <h2 className='text-2xl md:text-3xl font-bold text-shadow '>
                                    {t('title')}
                                </h2>
                            </div>
                            <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                        </div>
                        <ul className='space-y-3'>
                            {items.map((item, index) => (
                                <li key={item}>
                                    <p className='text-lg md:text-lg font-bold'>{item}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default NotionalCompany