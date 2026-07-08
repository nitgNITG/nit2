import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "تطوير منصات تعليمية احترافية"
            : "Educational Platform Development",
        description: isAr
            ? "تطوير منصات تعليمية مخصصة للجامعات والمدارس والمؤسسات في مصر والخليج. أنظمة إدارة التعلم LMS، بث مباشر، اختبارات إلكترونية وشهادات."
            : "Custom educational platform development for universities, schools & institutions in Egypt & the Gulf. LMS systems, live streaming, e-assessments & certificates.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/educational-platforms`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/educational-platforms",
                en: "https://www.nitg-eg.com/en/our-services/educational-platforms",
            },
        },
        openGraph: {
            title: isAr ? "تطوير منصات تعليمية احترافية | N.I.T Egypt" : "Educational Platform Development | N.I.T Egypt",
            description: "Custom LMS & educational platforms for universities, schools & enterprises — built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/educational-platforms`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function EducationalPlatformsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Educational Platform Development",
                        alternateName: "تطوير منصات تعليمية احترافية",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Custom LMS and educational platforms for universities, schools and enterprises with live streaming, e-assessments and certificate management.",
                        serviceType: "Educational Platform Development",
                        url: "https://www.nitg-eg.com/en/our-services/educational-platforms",
                    }),
                }}
            />
        </>
    );
}
