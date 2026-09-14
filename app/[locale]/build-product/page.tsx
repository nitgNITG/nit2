import React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { redirect } from '@/navigation'
import { getCurrentUser } from '@/lib/auth'
import BuildProductHeader from './components/BuildProductHeader'
import BuildProductForm from './BuildProductForm'
import Footer from '../components/Footer'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string }
}): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: 'BuildProduct' })
    return { title: t('heroTitle'), description: t('heroSubtitle') }
}

const page = async ({ searchParams }: { searchParams?: Record<string, string | string[]> }) => {
    // Building an academy requires an account (each academy is tied to its owner).
    // Carry the pre-selected plan through login via ?next= so the user returns here.
    const user = await getCurrentUser()
    if (!user) {
        const qs = new URLSearchParams(
            Object.entries(searchParams ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
        ).toString()
        const next = '/build-product' + (qs ? `?${qs}` : '')
        redirect(`/account?next=${encodeURIComponent(next)}`)
    }

    return (
        <div>
            <BuildProductHeader />

            <section className='relative bg-gray-50 py-16 md:py-24'>
                {/* Soft brand glow behind the card */}
                <div className='pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#1E7D67]/5 to-transparent' />
                <div className='p-container relative'>
                    <BuildProductForm editSlug={typeof searchParams?.edit === 'string' ? searchParams.edit : undefined} />
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default page
