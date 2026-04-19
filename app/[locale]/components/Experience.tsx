import { useTranslations } from 'next-intl'
import React from 'react'

const Experience = () => {
    const t = useTranslations('experience')
    return (
        <div className='p-container'>
            <div className='flex flex-col-reverse lg:grid grid-cols-12 py-10 lg:py-20 gap-10 lg:gap-20'>
                <div className='col-span-12 lg:col-span-6 '>
                    <p className='font-bold leading-[2.5]'>
                        {t('desc')}
                    </p>
                </div>
                <div className='col-span-12 lg:col-span-6 '>
                    <div className='space-y-5'>
                        <div className='space-y-2'>
                            <p className='text-lg lg:text-xl'>{t('hint')}</p>
                            <h3 className='text-2xl md:text-3xl font-bold leading-loose'>
                                {t('title.one')}<span className='text-aquaMint'>{" " + t("title.hero") + " "}</span>{t('title.two')}
                            </h3>
                        </div>
                        <div className='flex justify-end'>
                            <div className='w-32 bg-aquaMint h-2 rounded-full' />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Experience