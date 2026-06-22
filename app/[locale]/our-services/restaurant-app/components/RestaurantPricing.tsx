'use client'
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import LocaleLink from '../../../components/LocaleLink'
import { useLocale } from 'next-intl'

const WHATSAPP_NUMBER = '+201091568240'
const WHATSAPP_MSG = encodeURIComponent('مرحباً، أريد الاستفسار عن تطوير تطبيق مطعم')

const RestaurantPricing = () => {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const [plans, setPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('/api/plans?service=ecommerce')
            .then(r => setPlans(r.data.plans ?? []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    if (loading) return null
    if (plans.length === 0) return null

    return (
        <section className='py-16 bg-white'>
            <div className='p-container space-y-10'>

                <div className='text-center space-y-3'>
                    <span className='inline-block text-xs font-semibold tracking-widest uppercase text-[#268F79] border border-[#268F79]/30 px-4 py-1.5 rounded-full bg-[#268F79]/5'>
                        {isAr ? 'الأسعار' : 'Pricing'}
                    </span>
                    <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923]'>
                        {isAr ? 'باقات تطبيقات المطاعم' : 'Restaurant App Packages'}
                    </h2>
                    <p className='text-gray-500 text-sm'>
                        {isAr
                            ? 'الأسعار تبدأ من — السعر النهائي يعتمد على متطلبات مشروعك'
                            : 'Starting from — final price depends on your project requirements'}
                    </p>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {plans.map((plan, i) => (
                        <div key={plan.id}
                            className={`rounded-2xl border overflow-hidden flex flex-col ${i === 1 ? 'border-[#268F79] shadow-lg shadow-[#268F79]/10 scale-105' : 'border-gray-200 shadow-sm'}`}>
                            {i === 1 && (
                                <div className='bg-[#268F79] text-white text-xs font-bold text-center py-1.5 tracking-wider uppercase'>
                                    {isAr ? '⭐ الأكثر طلباً' : '⭐ Most Popular'}
                                </div>
                            )}
                            <div className='p-6 flex-1 space-y-4'>
                                <h3 className='font-bold text-lg text-[#0B2923]'>
                                    {isAr ? plan.nameAr : plan.nameEn}
                                </h3>
                                <div className='text-3xl font-bold text-[#268F79]'>
                                    {plan.price.toLocaleString()}
                                    <span className='text-base font-normal text-gray-400 mr-1'> {plan.currency}</span>
                                    <div className='text-xs font-normal text-gray-400 mt-0.5'>
                                        {isAr ? 'يبدأ من' : 'starting from'}
                                    </div>
                                </div>
                                <ul className='space-y-2'>
                                    {(isAr ? plan.featuresAr : plan.featuresEn)?.map((f: string, fi: number) => (
                                        <li key={fi} className='flex items-start gap-2 text-sm text-gray-700'>
                                            <span className='text-[#268F79] mt-0.5 shrink-0'>✓</span>
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className='p-4 pt-0 space-y-2'>
                                <LocaleLink href='/get-quote'
                                    className='block text-center bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold py-2.5 rounded-lg hover:opacity-90 transition-opacity text-sm'>
                                    {isAr ? 'احصل على عرض سعر' : 'Get a Quote'}
                                </LocaleLink>
                                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
                                    target='_blank' rel='noreferrer'
                                    className='flex items-center justify-center gap-2 border border-green-500 text-green-600 font-semibold py-2.5 rounded-lg hover:bg-green-50 transition-colors text-sm'>
                                    <span>💬</span>
                                    <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                                </a>
                            </div>
                        </div>
                    ))}
                </div>

                <p className='text-center text-xs text-gray-400'>
                    {isAr
                        ? '* جميع الباقات تشمل ضمان سنة وتدريب الفريق. تواصل معنا لعرض سعر مخصص لمشروعك.'
                        : '* All packages include 1-year warranty and team training. Contact us for a custom quote.'}
                </p>
            </div>
        </section>
    )
}

export default RestaurantPricing
