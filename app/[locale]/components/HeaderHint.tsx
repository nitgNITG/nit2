import React from 'react'
import { AppIcon, ClientsIcon, ExperienceIcon, ProjectsIcon } from './icons'
import { useTranslations, useLocale } from 'next-intl'
import CountUp from './CountUp'

const HeaderHint = () => {
    const t = useTranslations('hitHeader')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const hints = [
        { id: 1, text: t('item1'), end: 11, suffix: '+', icon: <ExperienceIcon /> },
        { id: 2, text: t('item2'), end: 90, suffix: '+', icon: <AppIcon /> },
        { id: 3, text: t('item3'), end: 10, suffix: '+', icon: <ProjectsIcon /> },
        { id: 4, text: t('item4'), end: 100, suffix: '+', icon: <ClientsIcon /> },
    ]

    return (
        <div className='bg-white py-10 rounded-[40px] shadow-2xl relative'>
            <ul className='grid grid-cols-12'>
                {(isAr ? [...hints].reverse() : hints).map((hint) => (
                    <li
                        key={hint.id}
                        className='col-span-12 sm:col-span-6 md:col-span-3 w-full flex justify-center'
                    >
                        <div className={clsx(
                            'flex flex-col items-center gap-2',
                            isAr ? 'sm:flex-row-reverse' : 'sm:flex-row'
                        )}>
                            <div>{hint.icon}</div>
                            <div className='text-center'>
                                <h4 className='text-lg md:text-2xl font-bold'>
                                    <CountUp end={hint.end} suffix={hint.suffix} />
                                </h4>
                                <span className='font-medium'>{hint.text}</span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}

// clsx needed client-side
import clsx from 'clsx'
export default HeaderHint
