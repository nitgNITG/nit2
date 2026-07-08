import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "شركة تصميم متجر إلكتروني وتطبيق تجارة إلكترونية"
            : "eCommerce App Development",
        description: isAr
            ? "تطوير تطبيقات التجارة الإلكترونية في مصر والخليج. تطبيقات iOS وAndroid على Google Play وApp Store. متاجر متعددة البائعين، تكامل فوري وباي موب وسترايب، أنظمة نقاط البيع."
            : "Custom eCommerce app development in Egypt. Native iOS & Android shopping apps on Google Play & App Store. Multivendor marketplaces, Fawry/PayMob/Stripe payment integration, POS systems.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/ecommerce-app`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/ecommerce-app",
                en: "https://www.nitg-eg.com/en/our-services/ecommerce-app",
            },
        },
        openGraph: {
            title: "eCommerce App Development | N.I.T Egypt",
            description: "Live eCommerce apps on Google Play & App Store. Multivendor, single-store, POS and payment gateway solutions built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/ecommerce-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "eCommerce App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "eCommerce App Development | N.I.T Egypt",
            description: "iOS & Android eCommerce apps with Fawry, PayMob & Stripe — built in Egypt since 2013.",
        },
    };
}

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
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Native iOS and Android eCommerce apps with multivendor support, Fawry/PayMob/Stripe payment integration, and POS systems.",
                        serviceType: "eCommerce App Development",
                        url: "https://www.nitg-eg.com/en/our-services/ecommerce-app",
                    }),
                }}
            />
        </>
    );
}
