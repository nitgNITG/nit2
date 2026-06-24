import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "شركة تطوير تطبيقات الأندرويد | N.I.T Egypt"
            : "Android App Development | N.I.T Egypt",
        description: isAr
            ? "تطوير وبرمجة تطبيقات الأندرويد في مصر والخليج. تطبيقات بـ Flutter منشورة على Google Play، بواجهات Material Design ودعم عربي كامل وأداء عالٍ."
            : "Custom Android app development in Egypt & the Gulf. Flutter apps published on Google Play, with Material Design UI, full Arabic support and high performance.",
        keywords: "Android app development Egypt, تصميم تطبيقات اندرويد, برمجة تطبيقات اندرويد, تطبيق اندرويد, Flutter app development Egypt, Google Play publishing, شركة تطوير تطبيقات اندرويد, تكلفة تطبيق اندرويد, Material Design app",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/our-services/android-app`,
            languages: {
                ar: "https://nitg-eg.com/ar/our-services/android-app",
                en: "https://nitg-eg.com/en/our-services/android-app",
            },
        },
        openGraph: {
            title: "Android App Development | N.I.T Egypt",
            description: "Android apps on Google Play — built with Flutter, Material Design, made in Egypt since 2013.",
            url: `https://nitg-eg.com/${locale}/our-services/android-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://nitg-eg.com/logo.svg", width: 512, height: 512, alt: "Android App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Android App Development | N.I.T Egypt",
            description: "Android apps on Google Play built with Flutter — made in Egypt since 2013.",
        },
    };
}

export default function AndroidLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Android App Development",
                        alternateName: "تصميم تطبيقات الأندرويد",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Android app development with Flutter, Material Design UI and Google Play publishing.",
                        serviceType: "Android App Development",
                        url: "https://nitg-eg.com/en/our-services/android-app",
                    }),
                }}
            />
        </>
    );
}
