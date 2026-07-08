import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "شركة تطوير تطبيقات الآيفون iOS"
            : "iPhone (iOS) App Development",
        description: isAr
            ? "تطوير وبرمجة تطبيقات الآيفون في مصر والخليج. تطبيقات iOS بـ Flutter منشورة على App Store، وفق معايير Apple وتكامل Apple Pay والإشعارات."
            : "Custom iPhone app development in Egypt & the Gulf. iOS apps built with Flutter published on the App Store, following Apple HIG with Apple Pay & push notifications.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/ios-app`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/ios-app",
                en: "https://www.nitg-eg.com/en/our-services/ios-app",
            },
        },
        openGraph: {
            title: "iPhone (iOS) App Development | N.I.T Egypt",
            description: "iOS apps on the App Store — built with Flutter, Apple HIG, made in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/ios-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "iPhone App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "iPhone (iOS) App Development | N.I.T Egypt",
            description: "iOS apps on the App Store built with Flutter — made in Egypt since 2013.",
        },
    };
}

export default function IosLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "iPhone App Development",
                        alternateName: "تصميم تطبيقات الآيفون",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "iOS app development with Flutter, following Apple HIG, with App Store publishing.",
                        serviceType: "iPhone App Development",
                        url: "https://www.nitg-eg.com/en/our-services/ios-app",
                    }),
                }}
            />
        </>
    );
}
