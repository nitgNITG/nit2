import React from 'react'
import Navbar from '../../components/Navbar'
import { Logo } from '../../components/icons'
import { useTranslations } from 'next-intl'

const OurProjectsHeader = () => {
    const t = useTranslations('projectPage')
    return (
        <header className=''>
            <div className='bg-[url("/our_projects.jpg")] bg-[-250px] md:bg-top bg-cover bg-no-repeat min-h-svh lg:min-h-[77svh] p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
                <div className='h-full p-container relative flex justify-center'>
                    <div className='absolute lg:right-0 top-20 md:top-10'>
                        <Logo className='size-56' />
                    </div>
                    <div className='lg:absolute top-20  left-0'>
                        <div className='relative flex justify-center items-center px-5'>
                            <div className='w-full absolute text-white bg-white/10 py-8 rounded-lg blur-[2px] ' />
                            <p className='text-white font-bold text-lg text-center'>
                                {t('title')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default OurProjectsHeader

/**
 *  <header className=''>
            <div className='bg-[url("/our_projects.jpg")] bg-[-250px] md:bg-top bg-cover md:bg-contain bg-no-repeat min-h-svh p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
                <div className='h-full p-container relative flex justify-center'>
                    <div className='absolute lg:right-0 top-20 md:top-10'>
                        <Logo className='size-56' />
                    </div>
                    <div className='lg:absolute top-20  left-0'>
                        <div className='relative flex justify-center items-center px-5'>
                            <div className='w-full absolute text-white bg-white/10 py-8 rounded-lg blur-[2px] ' />
                            <p className='text-white font-bold text-lg text-center'>
                                مشاريعنا البرمجية والتصميمية هي تجسيد لقدراتنا الاستثنائية
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
 */