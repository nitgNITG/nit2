import Image from 'next/image'
import React from 'react'

const ProjectsDetails = () => {
    return (
        <section className='p-container py-10'>
            <div className='bg-[#101922] w-full rounded-3xl'>
                <div className="flex flex-col-reverse pt-20 lg:pt-0 lg:grid grid-cols-12">
                    <div className='col-span-12 lg:col-span-6'>
                        <div className='px-20 pt-10'>
                            <Image
                                src={'/projects/8.png'}
                                alt=''
                                width={700}
                                height={700}
                                className='w-full h-full'
                            />
                        </div>
                    </div>
                    <div className='col-span-12 lg:col-span-6'>
                        <div className="flex items-center h-full px-10">
                            <div className='text-white space-y-5'>
                                <span className='text-xl font-bold'>مشروع</span>
                                <h5 className='text-2xl font-bold text-aquaMint'>أكاديمية التفوق</h5>
                                <p className='text-lg font-semibold'>
                                    اكاديمية التفوق هي المنصة الرائده في مجال التعليم الالكتروني ، المشروع مكون من تطبيق وموقع الكتروني حيث يتاح للمدرسين الاشتراك وسهولة الوصول لطلابهم</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className='grid grid-cols-12 space-y-10 lg:space-y-0 lg:gap-20 mt-10 lg:mt-20'>
                <div className='col-span-12 lg:col-span-6'>
                    <div className='bg-[#101922] w-full rounded-3xl pt-20'>
                        <div className="grid grid-cols-12">
                            <div className='col-span-12'>
                                <div className="flex items-center h-full px-10">
                                    <div className='text-white space-y-5'>
                                        <span className='text-xl font-bold'>مشروع</span>
                                        <h5 className='text-2xl font-bold text-aquaMint'>أكاديمية التفوق</h5>
                                        <p className='text-lg font-semibold'>
                                            اكاديمية التفوق هي المنصة الرائده في مجال التعليم الالكتروني ، المشروع مكون من تطبيق وموقع الكتروني حيث يتاح للمدرسين الاشتراك وسهولة الوصول لطلابهم</p>
                                    </div>
                                </div>
                            </div>
                            <div className='col-span-12 mt-6 lg:mt-24'>
                                <div className='flex justify-center'>
                                    <Image
                                        src={'/projects/9.png'}
                                        alt=''
                                        width={700}
                                        height={700}
                                        className='w-96 h-96 object-contain'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6'>
                    <div className='bg-[#101922] w-full rounded-3xl pt-20'>
                        <div className="grid grid-cols-12">
                            <div className='col-span-12'>
                                <div className="flex items-center h-full px-10">
                                    <div className='text-white space-y-5'>
                                        <span className='text-xl font-bold'>مشروع</span>
                                        <h5 className='text-2xl font-bold text-aquaMint'>أكاديمية التدريب المهني</h5>
                                        <p className='text-lg font-semibold'>
                                            اكاديمية التدريب المهني هي المنصة التابعة لوزارة العمل في مصر لتعليم مجال تعليم الحرف والصناعة للعمال ، المشروع مكون من تطبيق وموقع الكتروني.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className='col-span-12 mt-10 lg:mt-32'>
                                <div className='px-20 pt-10'>
                                    <Image
                                        src={'/projects/7.png'}
                                        alt=''
                                        width={700}
                                        height={700}
                                        className='w-full h-full object-contain'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default ProjectsDetails