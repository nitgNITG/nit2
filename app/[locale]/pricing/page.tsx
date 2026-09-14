import React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ScrollReveal from '../components/ScrollReveal'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import PricingPlans from './PricingPlans'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string }
}): Promise<Metadata> {
    const ar = locale === 'ar'
    return {
        title: ar ? 'الأسعار والباقات — أكاديمية N.I.T' : 'Pricing & Plans — N.I.T Academy',
        description: ar
            ? 'اختر الباقة المناسبة لأكاديميتك — استضافة وتحديثات وترقية في أي وقت.'
            : 'Choose the plan that fits your academy — hosting, updates, and upgrade anytime.',
    }
}

const PricingPage = async ({ params: { locale } }: { params: { locale: string } }) => {
    const ar = locale === 'ar'
    // Touch getTranslations so the locale is initialised for server metadata parity.
    await getTranslations({ locale, namespace: 'Navbar' }).catch(() => null)

    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'pricing', ar: 'الأسعار', en: 'Pricing' }]} />

            <section className='relative overflow-hidden bg-[#0B2923] pb-16 text-center text-white md:pb-24'>
                <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,125,103,0.35),transparent_60%)]' />
                {/* Top accent line + Navbar (each page renders its own). */}
                <div className='absolute left-0 right-0 top-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #1E7D67, #00FFCD, #1E7D67, transparent)' }} />
                <div className='p-container relative z-[99] py-8 text-start'>
                    <Navbar />
                </div>
                <div className='p-container relative space-y-4 pt-8'>
                    <span className='inline-block rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#7fe9c8]'>
                        {ar ? 'الأسعار' : 'Pricing'}
                    </span>
                    <h1 className='text-3xl font-extrabold md:text-5xl'>
                        {ar ? 'اختر الباقة التي تناسب أكاديميتك' : 'Choose the plan that fits your academy'}
                    </h1>
                    <p className='mx-auto max-w-2xl text-sm text-white/70 md:text-base'>
                        {ar
                            ? 'كل ما تحتاجه لإطلاق منصتك التعليمية وإدارتها — استضافة، تحديثات، ودعم. ابدأ مجاناً وطوّر باقتك وقت ما تحب.'
                            : 'Everything you need to launch and run your learning platform — hosting, updates, and support. Start free and scale up whenever you like.'}
                    </p>
                    <div className='flex flex-wrap justify-center gap-4 pt-2 text-xs text-white/60'>
                        <span>✓ {ar ? 'ترقية في أي وقت' : 'Upgrade anytime'}</span>
                        <span>✓ {ar ? 'استضافة وتحديثات' : 'Hosting & updates'}</span>
                        <span>✓ {ar ? 'دعم فني' : 'Support'}</span>
                    </div>
                </div>
            </section>

            <section className='bg-gray-50 py-16 md:py-20'>
                <div className='p-container'>
                    <ScrollReveal><PricingPlans /></ScrollReveal>
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default PricingPage
