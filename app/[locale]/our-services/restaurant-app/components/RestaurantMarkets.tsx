import React from 'react'
import LocaleLink from '../../../components/LocaleLink'

const AUDIENCE = [
    { icon: '🍽️', ar: 'المطاعم والكافيهات', en: 'Restaurants & Cafés' },
    { icon: '🍔', ar: 'سلاسل الوجبات السريعة', en: 'Fast-Food Chains' },
    { icon: '🏬', ar: 'المطاعم متعددة الفروع', en: 'Multi-Branch Restaurants' },
    { icon: '☁️', ar: 'المطابخ السحابية (Cloud Kitchens)', en: 'Cloud Kitchens' },
    { icon: '🥡', ar: 'مطاعم التيك أواي والتوصيل', en: 'Takeaway & Delivery Outlets' },
    { icon: '🧁', ar: 'الحلويات والمخابز', en: 'Bakeries & Dessert Shops' },
]

const RestaurantMarkets = () => {
    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-10'>
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        نخدم مصر والخليج
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        من يحتاج تطبيق مطعم؟
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        من المطعم الواحد إلى السلسلة متعددة الفروع
                    </p>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                    {AUDIENCE.map((a, i) => (
                        <div key={i} className='bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4'>
                            <span className='text-3xl flex-shrink-0'>{a.icon}</span>
                            <div>
                                <p className='font-bold text-sm text-[#0B2923]' dir='rtl'>{a.ar}</p>
                                <p className='text-xs text-gray-400'>{a.en}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className='flex justify-center'>
                    <LocaleLink href='/contact'
                        className='bg-[#00FFB2] text-[#0B2923] font-bold px-8 py-3 rounded-lg hover:bg-[#00e6a0] transition-colors'>
                        احجز استشارة مجانية — 30 دقيقة
                    </LocaleLink>
                </div>
            </div>
        </section>
    )
}

export default RestaurantMarkets
