import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "تطوير منصات تعليمية احترافية | N.I.T Egypt"
            : "Educational Platform Development | N.I.T Egypt",
        description: isAr
            ? "تطوير منصات تعليمية مخصصة للجامعات والمدارس والمؤسسات في مصر والخليج. أنظمة إدارة التعلم LMS، بث مباشر، اختبارات إلكترونية وشهادات."
            : "Custom educational platform development for universities, schools & institutions in Egypt & the Gulf. LMS systems, live streaming, e-assessments & certificates.",
        keywords: "educational platform development, LMS development Egypt, منصات تعليمية, تطوير منصة تعليمية, نظام إدارة التعلم, e-learning platform Egypt, custom LMS, شركة تصميم منصة تعليمية",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/our-services/educational-platforms`,
            languages: {
                ar: "https://nitg-eg.com/ar/our-services/educational-platforms",
                en: "https://nitg-eg.com/en/our-services/educational-platforms",
            },
        },
        openGraph: {
            title: isAr ? "تطوير منصات تعليمية احترافية | N.I.T Egypt" : "Educational Platform Development | N.I.T Egypt",
            description: "Custom LMS & educational platforms for universities, schools & enterprises — built in Egypt since 2013.",
            url: `https://nitg-eg.com/${locale}/our-services/educational-platforms`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function EducationalPlatformsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
