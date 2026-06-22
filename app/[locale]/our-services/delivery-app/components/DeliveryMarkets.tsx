import React from 'react'
import LocaleLink from '../../../components/LocaleLink'

const AUDIENCE = [
    { icon: '🍔', ar: 'توصيل الطعام والمطاعم', en: 'Food & Restaurant Delivery' },
    { icon: '🛒', ar: 'توصيل البقالة والسوبر ماركت', en: 'Grocery & Supermarket Delivery' },
    { icon: '💊', ar: 'توصيل الصيدليات', en: 'Pharmacy Delivery' },
    { icon: '📦', ar: 'شركات التوريدات والشحن', en: 'Supplies & Courier Companies' },
    { icon: '🚚', ar: 'خدمات التوصيل متعدد الفئات', en: 'Multi-Category On-Demand' },
    { icon: '🏪', ar: 'المتاجر التي تريد أسطول توصيل خاص', en: 'Stores Building Their Own Fleet' },
]

const DeliveryMarkets = () => {
    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-10'>
                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        نخدم مصر والخليج
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        من يحتاج تطبيق توصيل؟
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        من القاهرة إلى الرياض — نبني تطبيقات توصيل تناسب نشاطك
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

export default DeliveryMarkets
