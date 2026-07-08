import React from 'react'
import { AppIcon, ClientsIcon, ExperienceIcon, ProjectsIcon } from './icons'
import { useTranslations, useLocale } from 'next-intl'
import clsx from 'clsx'

// Renders real values in HTML (SSR) so Google indexes "11+" not "0+"
// The CSS animation is handled via globals.css .counter-value class
const HeaderHint = () => {
    const t = useTranslations('hitHeader')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const hints = [
        { id: 1, text: t('item1'), value: '11+', icon: <ExperienceIcon /> },
        { id: 2, text: t('item2'), value: '90+', icon: <AppIcon /> },
        { id: 3, text: t('item3'), value: '10+', icon: <ProjectsIcon /> },
        { id: 4, text: t('item4'), value: '100+', icon: <ClientsIcon /> },
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
                                    {hint.value}
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

export default HeaderHint
