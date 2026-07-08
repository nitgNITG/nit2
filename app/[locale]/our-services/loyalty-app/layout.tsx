import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "تطوير أنظمة ولاء العملاء والنقاط والمكافآت"
            : "Customer Loyalty & Rewards App Development",
        description: isAr
            ? "تطوير برامج ولاء العملاء وأنظمة النقاط والمكافآت في مصر والخليج — تطبيق نقاط وكوبونات وبطاقات عضوية رقمية مع لوحة تحليلات وتكامل نقاط البيع."
            : "Customer loyalty program & rewards app development in Egypt & the Gulf — points, coupons and digital membership cards with an analytics dashboard and POS integration.",
        keywords: "برنامج ولاء العملاء, نظام نقاط ومكافآت, تطبيق ولاء العملاء, نظام ولاء, نظام ولاء العملاء, أنظمة الولاء, أنواع أنظمة الولاء, أنظمة الولاء في السعودية, بطاقة عضوية رقمية, customer loyalty program, loyalty app development, points and rewards system, loyalty rewards app",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/loyalty-app`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/loyalty-app",
                en: "https://www.nitg-eg.com/en/our-services/loyalty-app",
            },
        },
        openGraph: {
            title: "Customer Loyalty & Rewards App Development | N.I.T Egypt",
            description: "Loyalty apps with points, coupons, digital cards and a CRM analytics dashboard. Built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/loyalty-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/logo.svg", width: 512, height: 512, alt: "Customer Loyalty App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Customer Loyalty & Rewards App Development | N.I.T Egypt",
            description: "Points, coupons & rewards loyalty apps — built in Egypt since 2013.",
        },
    };
}

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Customer Loyalty App Development",
                        alternateName: "تطوير أنظمة ولاء العملاء",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Customer loyalty and rewards apps with a points engine, coupons, digital membership cards, CRM analytics and POS integration.",
                        serviceType: "Customer Loyalty & Rewards App Development",
                        url: "https://www.nitg-eg.com/en/our-services/loyalty-app",
                    }),
                }}
            />
        </>
    );
}
