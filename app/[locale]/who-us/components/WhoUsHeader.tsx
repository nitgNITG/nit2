import React from 'react'
import Navbar from '../../components/Navbar'
import { useTranslations } from 'next-intl'

const WhoUsHeader = () => {
    const t = useTranslations('whous')
    return (
        <header className=''>
            <div className='bg-[url("/header_whous.jpg")] bg-[-250px] md:bg-center bg-cover bg-no-repeat min-h-svh p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
                <div className='flex justify-center items-center mt-20 lg:mt-32'>
                    <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center drop-shadow-lg'>
                        {t('hint')}
                    </h1>
                </div>
            </div>
        </header>
    )
}

export default WhoUsHeader