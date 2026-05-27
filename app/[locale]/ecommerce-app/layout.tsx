import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "eCommerce App Development | تطوير تطبيقات التجارة الإلكترونية | N.I.T Egypt",
    description: "Custom eCommerce app development in Egypt. Native iOS & Android shopping apps on Google Play & App Store. Multivendor marketplaces, Fawry/PayMob/Stripe payment integration, POS systems. تطوير تطبيقات التجارة الإلكترونية في مصر والخليج.",
    keywords: "eCommerce app development Egypt, mobile shopping app, multivendor marketplace, Fawry PayMob integration, تجارة إلكترونية مصر, تطبيق متجر, Google Play App Store Egypt, POS system Egypt",
    alternates: {
        canonical: "https://nitg-eg.com/ar/ecommerce-app",
        languages: {
            ar: "https://nitg-eg.com/ar/ecommerce-app",
            en: "https://nitg-eg.com/en/ecommerce-app",
        },
    },
    openGraph: {
        title: "eCommerce App Development | N.I.T Egypt",
        description: "Live eCommerce apps on Google Play & App Store. Multivendor, single-store, POS and payment gateway solutions built in Egypt since 2013.",
        url: "https://nitg-eg.com/en/ecommerce-app",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "eCommerce App Development | N.I.T Egypt",
        description: "iOS & Android eCommerce apps with Fawry, PayMob & Stripe — built in Egypt since 2013.",
    },
};

export default function EcommerceLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "eCommerce App Development",
                        alternateName: "تطوير تطبيقات التجارة الإلكترونية",
                        provider: {
                            "@type": "Organization",
                            name: "N.I.T Egypt",
                            url: "https://nitg-eg.com",
                        },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Native iOS and Android eCommerce apps with multivendor support, Fawry/PayMob/Stripe payment integration, and POS systems.",
                        serviceType: "eCommerce App Development",
                        url: "https://nitg-eg.com/en/ecommerce-app",
                    }),
                }}
            />
        </>
    );
}
