import React from 'react'
import Navbar from '../../components/Navbar'
import { Logo } from '../../components/icons'

const MoodleHeader = () => {
    return (
        <header className=''>
            <div className='bg-[url("/our_projects.jpg")] bg-[-250px] md:bg-top bg-cover bg-no-repeat min-h-svh lg:min-h-[77svh] p-container'>
                <div className='py-10'>
                    <Navbar />
                </div>
                <div className='h-full p-container relative flex justify-center'>
                    <div className='absolute lg:right-0 top-56 lg:top-10'>
                        <Logo className='size-56' />
                    </div>
                    <div className='lg:absolute top-20 left-0 lg:w-[700px]'>
                        <div className='relative flex flex-col justify-center items-center py-10 lg:py-10 px-5 gap-4'>
                            <div className='w-full absolute text-white bg-white/10 py-24 lg:py-28 rounded-lg blur-[2px]' />
                            <p className='text-white font-bold text-2xl md:text-3xl text-center relative z-10'>
                                Moodle LMS Development
                            </p>
                            <p className='text-white/90 font-semibold text-base text-center relative z-10 max-w-lg'>
                                Custom Moodle platforms for schools, universities & corporate training — built and deployed since 2013
                            </p>
                            <p className='text-white font-bold text-2xl md:text-3xl text-center relative z-10 mt-1' dir='rtl'>
                                تطوير منصات Moodle التعليمية
                            </p>
                            <p className='text-white/90 font-semibold text-base text-center relative z-10 max-w-lg' dir='rtl'>
                                منصات مودل مخصصة للمدارس والجامعات والتدريب المؤسسي — نبني وندير منذ ٢٠١٣
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default MoodleHeader
