import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'eCommerce App Development | تطوير تطبيقات التجارة الإلكترونية | N.I.T Egypt',
    description: 'Custom eCommerce app development in Egypt. Mobile apps on Google Play & App Store, multivendor marketplaces, POS integration. تطوير تطبيقات التجارة الإلكترونية في مصر والخليج.',
    keywords: 'eCommerce app development Egypt, multivendor marketplace, mobile shopping app, Google Play App Store, تجارة إلكترونية, تطبيق متجر',
    openGraph: {
        title: 'eCommerce App Development | N.I.T Egypt',
        description: 'Live eCommerce apps on Google Play & App Store. Multivendor, single-store, and POS solutions built in Egypt since 2013.',
        type: 'website',
    },
}

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
