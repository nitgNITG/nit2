import React from 'react'
import { ContributIcon, EchivementIcon, ViaInternetIcon } from '../../components/icons'
import { useTranslations } from 'next-intl'

const WhoUsCards = () => {
    const t = useTranslations('whous.cards')
    const cards = [
        {
            id: 1,
            icon: <EchivementIcon />,
            desc: t('card1')
        },
        {
            id: 2,
            icon: <ContributIcon />,
            desc: t('card1')
        },
        {
            id: 3,
            icon: <ViaInternetIcon />,
            desc: t('card3')
        },
    ]
    return (
        <section className='p-container py-10 lg:py-20'>
            <div className='grid grid-cols-12 md:gap-8  lg:gap-16 xl:gap-20 '>
                {
                    cards.map((card, index) => (
                        <div key={card.id} className='col-span-12 md:col-span-6 lg:col-span-4 h-full pt-32 md:pt-24 lg:pt-10 xl:pt-0'>
                            <div className='h-full'>
                                <div className='flex justify-center relative items-center'>
                                    <div className='absolute'>
                                        {card.icon}
                                    </div>
                                </div>
                                <div className='bg-[#F2F3FA] py-20 lg:py-32 px-5 md:px-10 lg:px-20 h-full font-bold rounded-md who-us-card'>
                                    <p>
                                        {card.desc}
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

export default WhoUsCards