import Image from 'next/image'
import React from 'react'
import service from '../../assets/services.png'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import LocaleLink from './LocaleLink'
const OurServices = () => {
    const t = useTranslations('services');
    const services = [
        {
            id: 1,
            title: t('item1.title'),
            desc: t('item1.desc')
        },
        {
            id: 2,
            title: t('item2.title'),
            desc: t('item2.desc')
        },
        {
            id: 3,
            title: t('item3.title'),
            desc: t('item3.desc')
        },
    ]
    return (
        <section className='bg-[#F2F3FA] pt-96 sm:pt-52 md:pt-32 pb-10 p-container'>
            <div className='grid grid-cols-12 space-y-10 '>
                <div className='col-span-12 lg:col-span-6 flex items-center h-full'>
                    <div className='w-full lg:px-10 py-5'>
                        <Image
                            src={service}
                            alt=''
                            loading='lazy'
                            width={1000}
                            height={1000}
                            className='w-full h-full'
                        />
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6 '>
                    <div className='space-y-10'>
                        <div className='space-y-3'>
                            <p>{t('hint')}</p>
                            <div className='flex -space-x-5 lg:-space-x-8 items-center justify-end'>
                                <div className='z-10'>
                                    <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                                        {t('title.one')}<span className='text-aquaMint'>{" " + t('title.hero') + " "}</span> {t('title.two')}
                                    </h2>
                                </div>
                                <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                            </div>
                        </div>
                        <ul>
                            {services.map((service, i) => (
                                <li
                                    key={service.id}
                                    className={clsx(
                                        'px-10',
                                        { 'bg-white rounded-xl': i == 0 }
                                    )}
                                >
                                    <div className='flex justify-end items-center gap-3'>
                                        <div className='flex flex-col items-end gap-2'>
                                            <h3 className='text-lg font-bold'>{service.title}</h3>
                                            <div className='lg:w-10/12 flex'>
                                                <p className='text-sm'>{service.desc}</p>
                                            </div>
                                        </div>
                                        <div className='text-[88px] bg-clip-text text-transparent bg-gradient-to-b from-[#00FFCD] to-[#00997a9c]'>{i + 1}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className='flex justify-end'>
                            <LocaleLink href={'/contact'} target='_blank' className='hidden lg:block bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                                <span className='text-[#00FFB2] font-bold'>
                                    {t('btn')}
                                </span>
                            </LocaleLink>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default OurServices