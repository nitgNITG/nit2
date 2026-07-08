import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "تطوير تطبيقات المطاعم ونظام إدارة المطعم"
            : "Restaurant App Development",
        description: isAr
            ? "تصميم تطبيق مطعم في مصر والخليج — تطبيق طلب ودليفري باسم مطعمك، قائمة رقمية، نقاط بيع POS، ونظام إدارة مطاعم متعدد الفروع."
            : "Restaurant app development in Egypt & the Gulf — your own-brand ordering & delivery app, digital menu, POS, and a multi-branch restaurant management system.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/restaurant-app`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/restaurant-app",
                en: "https://www.nitg-eg.com/en/our-services/restaurant-app",
            },
        },
        openGraph: {
            title: "Restaurant App Development | N.I.T Egypt",
            description: "Own-brand restaurant ordering & delivery apps with digital menus, POS and multi-branch management. Built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/restaurant-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "Restaurant App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Restaurant App Development | N.I.T Egypt",
            description: "Branded restaurant ordering, delivery & POS apps — built in Egypt since 2013.",
        },
    };
}

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Restaurant App Development",
                        alternateName: "تطوير تطبيقات المطاعم",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Branded restaurant ordering and delivery apps with digital menus, POS systems, kitchen displays and multi-branch management.",
                        serviceType: "Restaurant Ordering & Management App Development",
                        url: "https://www.nitg-eg.com/en/our-services/restaurant-app",
                    }),
                }}
            />
        </>
    );
}
