import React from 'react'
import LocaleLink from '../../components/LocaleLink'

const EG_CLIENTS = [
    { icon: '🛍️', ar: 'تجار التجزئة والبازارات', en: 'Retail Merchants & Bazaars' },
    { icon: '🏪', ar: 'محلات البيع الإلكتروني', en: 'Online Shops & Boutiques' },
    { icon: '🏭', ar: 'المصانع والموردون', en: 'Factories & Wholesalers' },
    { icon: '🍕', ar: 'مطاعم وطلبات الطعام', en: 'Restaurants & Food Delivery' },
    { icon: '💊', ar: 'الصيدليات والمنتجات الصحية', en: 'Pharmacies & Health Products' },
    { icon: '🏬', ar: 'منصات Multi-vendor', en: 'Multi-vendor Marketplaces' },
];

const GULF_CLIENTS = [
    { icon: '🛢️', ar: 'متاجر المواد والمعدات الصناعية', en: 'Industrial Goods & Equipment Stores' },
    { icon: '💎', ar: 'متاجر المجوهرات والفاخرة', en: 'Jewelry & Luxury Goods Stores' },
    { icon: '🏗️', ar: 'متاجر مواد البناء', en: 'Building Materials Stores' },
    { icon: '👗', ar: 'الأزياء والملابس', en: 'Fashion & Clothing' },
    { icon: '🔌', ar: 'الإلكترونيات والأجهزة', en: 'Electronics & Gadgets' },
    { icon: '🏬', ar: 'منصات Multivendor الخليجية', en: 'Gulf Multivendor Platforms' },
];

const FEATURES_COMMON = [
    { icon: '📱', ar: 'تطبيق iOS وAndroid', en: 'iOS & Android App' },
    { icon: '💳', ar: 'مدى / STC Pay / KNET / Fawry', en: 'Mada / STC Pay / KNET / Fawry' },
    { icon: '🚚', ar: 'تكامل مع شركات الشحن', en: 'Shipping Companies Integration' },
    { icon: '🌐', ar: 'دعم عربي وإنجليزي', en: 'Arabic & English Support' },
    { icon: '📊', ar: 'لوحة تحكم المبيعات', en: 'Sales Dashboard & Analytics' },
    { icon: '🏬', ar: 'نظام Multi-vendor اختياري', en: 'Optional Multi-vendor System' },
];

const EcommerceMarkets = () => {
    return (
        <section className='py-16 bg-gray-50'>
            <div className='p-container space-y-12'>

                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        نخدم مصر والخليج
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        من يستفيد من متجر إلكتروني؟
                    </h2>
                    <p className='text-gray-500 max-w-xl mx-auto text-sm'>
                        من القاهرة إلى الرياض — نبني متاجر إلكترونية وتطبيقات جوال تناسب سوقك
                    </p>
                </div>

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>

                    {/* Egypt */}
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                        <div className='bg-gradient-to-r from-[#0B2923] to-[#268F79] px-6 py-4 flex items-center gap-3'>
                            <span className='text-3xl'>🇪🇬</span>
                            <div>
                                <h3 className='text-white font-bold text-lg'>السوق المصري</h3>
                                <p className='text-[#00FFB2] text-xs'>Egypt Market</p>
                            </div>
                        </div>
                        <div className='p-6 space-y-3'>
                            {EG_CLIENTS.map((c, i) => (
                                <div key={i} className='flex items-center gap-3 py-2 border-b border-gray-50 last:border-0'>
                                    <span className='text-xl'>{c.icon}</span>
                                    <div>
                                        <p className='font-semibold text-sm text-[#0B2923]' dir='rtl'>{c.ar}</p>
                                        <p className='text-xs text-gray-400'>{c.en}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gulf */}
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
                        <div className='bg-gradient-to-r from-[#0B2923] to-[#1a6b58] px-6 py-4 flex items-center gap-3'>
                            <span className='text-3xl'>🌍</span>
                            <div>
                                <h3 className='text-white font-bold text-lg'>دول الخليج العربي</h3>
                                <p className='text-[#00FFB2] text-xs'>Saudi Arabia · UAE · Qatar · Kuwait · Bahrain · Oman</p>
                            </div>
                        </div>
                        <div className='p-6 space-y-3'>
                            {GULF_CLIENTS.map((c, i) => (
                                <div key={i} className='flex items-center gap-3 py-2 border-b border-gray-50 last:border-0'>
                                    <span className='text-xl'>{c.icon}</span>
                                    <div>
                                        <p className='font-semibold text-sm text-[#0B2923]' dir='rtl'>{c.ar}</p>
                                        <p className='text-xs text-gray-400'>{c.en}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Common features strip */}
                <div className='bg-[#0B2923] rounded-2xl p-6 md:p-8'>
                    <h3 className='text-white font-bold text-center text-lg mb-6'>كل متجر يشمل بالأساس</h3>
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                        {FEATURES_COMMON.map((f, i) => (
                            <div key={i} className='flex items-center gap-2'>
                                <span className='text-xl'>{f.icon}</span>
                                <span className='text-[#00FFB2] text-sm font-medium' dir='rtl'>{f.ar}</span>
                            </div>
                        ))}
                    </div>
                    <div className='flex justify-center mt-8'>
                        <LocaleLink href='/contact'
                            className='bg-[#00FFB2] text-[#0B2923] font-bold px-8 py-3 rounded-lg hover:bg-[#00e6a0] transition-colors'>
                            احجز استشارة مجانية — 30 دقيقة
                        </LocaleLink>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default EcommerceMarkets
