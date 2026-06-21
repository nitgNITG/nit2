import React from 'react'
import LocaleLink from '../../components/LocaleLink'

const liveApps = [
    {
        name: 'Multi-Vendor Shopping App',
        nameAr: 'تطبيق تسوق متعدد البائعين',
        type: 'Multivendor Marketplace',
        typeAr: 'سوق متعدد البائعين',
        platforms: ['Google Play', 'App Store'],
        desc: 'Full marketplace app with seller dashboards, real-time inventory, Fawry & PayMob integration.',
    },
    {
        name: 'Retail eCommerce App',
        nameAr: 'تطبيق متجر إلكتروني',
        type: 'Single-Store Retail',
        typeAr: 'متجر فردي',
        platforms: ['Google Play', 'App Store'],
        desc: 'Fast, lightweight shopping app with product catalog, cart, checkout and order tracking.',
    },
    {
        name: 'Selling Points Network',
        nameAr: 'شبكة نقاط البيع',
        type: 'POS Integration',
        typeAr: 'تكامل نقاط البيع',
        platforms: ['Google Play'],
        desc: 'Unified system connecting physical stores with an online platform for real-time stock and sales sync.',
    },
]

const EcommerceApps = () => {
    return (
        <section className='p-container py-10 lg:py-20'>
            <div className='space-y-5 mb-10'>
                <p className='text-center text-sm text-gray-500'>تطبيقاتنا الحية · Our Live Apps</p>
                <div className='flex -space-x-5 lg:-space-x-8 items-center justify-center'>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                    <div className='z-10'>
                        <h2 className='text-2xl md:text-3xl font-bold text-shadow text-center px-4'>
                            Live <span className='text-darkAquaMint'>eCommerce</span> Apps
                        </h2>
                    </div>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                </div>
            </div>

            <div className='grid grid-cols-12 gap-6'>
                {liveApps.map((app, i) => (
                    <div key={i} className='col-span-12 md:col-span-6 lg:col-span-4'>
                        <div className='bg-white border rounded-xl p-6 space-y-3 h-full hover:shadow-lg transition-shadow duration-200'>
                            <div className='flex items-center justify-between flex-wrap gap-2'>
                                <span className='text-xs font-semibold text-[#268F79] bg-[#268F79]/10 px-3 py-1 rounded-full'>{app.type}</span>
                                <span className='text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full'>{app.typeAr}</span>
                            </div>
                            <div>
                                <h3 className='font-bold text-lg text-right'>{app.nameAr}</h3>
                                <h3 className='font-semibold text-base text-left text-gray-700'>{app.name}</h3>
                            </div>
                            <p className='text-sm text-gray-500 text-right'>{app.desc}</p>
                            <div className='flex items-center gap-3 pt-1 flex-wrap'>
                                <div className='flex items-center gap-1'>
                                    <div className='size-2 rounded-full bg-green-400' />
                                    <span className='text-xs text-gray-400 font-medium'>Live · حي</span>
                                </div>
                                <div className='flex gap-2'>
                                    {app.platforms.map(p => (
                                        <span key={p} className='text-xs bg-[#0F1922] text-white px-2 py-0.5 rounded font-medium'>{p}</span>
                                    ))}
                                </div>
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

export default EcommerceApps
