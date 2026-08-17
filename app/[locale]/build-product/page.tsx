import React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import BuildProductHeader from './components/BuildProductHeader'
import BuildProductForm from './BuildProductForm'
import Footer from '../components/Footer'

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string }
}): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: 'BuildProduct' })
    return { title: t('heroTitle'), description: t('heroSubtitle') }
}

const page = () => {
    return (
        <div>
            <BuildProductHeader />

            <section className='relative bg-gray-50 py-16 md:py-24'>
                {/* Soft brand glow behind the card */}
                <div className='pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#1E7D67]/5 to-transparent' />
                <div className='p-container relative'>
                    <BuildProductForm />
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default page
