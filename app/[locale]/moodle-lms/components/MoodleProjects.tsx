import React from 'react'
import LocaleLink from '../../components/LocaleLink'

const liveProjects = [
    {
        name: 'University E-Learning Portal',
        nameAr: 'بوابة التعلم الإلكتروني الجامعية',
        type: 'Higher Education',
        typeAr: 'التعليم الجامعي',
        desc: 'Full Moodle platform for 10,000+ students with custom theme, Arabic RTL and mobile app.',
    },
    {
        name: 'Corporate Training LMS',
        nameAr: 'منصة التدريب المؤسسي',
        type: 'Enterprise Training',
        typeAr: 'التدريب المؤسسي',
        desc: 'Internal training platform for a major Egyptian company with SCORM courses and completion tracking.',
    },
    {
        name: 'K-12 Educational Platform',
        nameAr: 'منصة التعليم الأساسي والثانوي',
        type: 'School System',
        typeAr: 'نظام مدرسي',
        desc: 'Moodle-based school platform with parent portal, grading system, and video lessons.',
    },
]

const MoodleProjects = () => {
    return (
        <section className='p-container py-10 lg:py-20'>
            <div className='space-y-5 mb-10'>
                <p className='text-center text-sm text-gray-500'>منصاتنا الحية · Our Live Platforms</p>
                <div className='flex -space-x-5 lg:-space-x-8 items-center justify-center'>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                    <div className='z-10'>
                        <h2 className='text-2xl md:text-3xl font-bold text-shadow text-center px-4'>
                            Live <span className='text-darkAquaMint'>Moodle</span> Deployments
                        </h2>
                    </div>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                </div>
            </div>

            <div className='grid grid-cols-12 gap-6'>
                {liveProjects.map((project, i) => (
                    <div key={i} className='col-span-12 md:col-span-6 lg:col-span-4'>
                        <div className='bg-white border rounded-xl p-6 space-y-3 h-full hover:shadow-lg transition-shadow duration-200'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-[#268F79] bg-[#268F79]/10 px-3 py-1 rounded-full'>{project.type}</span>
                                <span className='text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full'>{project.typeAr}</span>
                            </div>
                            <div>
                                <h3 className='font-bold text-lg text-right'>{project.nameAr}</h3>
                                <h3 className='font-semibold text-base text-left text-gray-700'>{project.name}</h3>
                            </div>
                            <p className='text-sm text-gray-500 text-right'>{project.desc}</p>
                            <div className='flex items-center gap-2 pt-1'>
                                <div className='size-2 rounded-full bg-green-400' />
                                <span className='text-xs text-gray-400 font-medium'>Live · حي</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className='flex justify-center mt-10'>
                <LocaleLink href='/our-projects' className='bg-gradient-to-b from-[#268F79] to-[#0B2923] px-6 py-3 rounded-md'>
                    <span className='text-[#00FFB2] font-bold'>View All Projects · شاهد كل المشاريع</span>
                </LocaleLink>
            </div>
        </section>
    )
}

export default MoodleProjects
