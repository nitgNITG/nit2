import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "منصات تعليم بالذكاء الاصطناعي | N.I.T Egypt"
            : "AI Educational Platforms | N.I.T Egypt",
        description: isAr
            ? "تطوير منصات تعليمية تعتمد على الذكاء الاصطناعي في مصر والخليج. توفير مسارات تعلم ذكية، تحليل أداء الطلاب ومساعدين افتراضيين للتعليم."
            : "AI-powered educational platform development in Egypt & the Gulf. Smart learning paths, student performance analytics, and virtual teaching assistants.",
        keywords: "AI educational platforms, AI LMS Egypt, منصات تعليم بالذكاء الاصطناعي, تطوير نظام تعليمي ذكي, AI learning paths, smart e-learning Egypt",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/our-services/ai-educational-platforms`,
            languages: {
                ar: "https://nitg-eg.com/ar/our-services/ai-educational-platforms",
                en: "https://nitg-eg.com/en/our-services/ai-educational-platforms",
            },
        },
        openGraph: {
            title: isAr ? "منصات تعليم بالذكاء الاصطناعي | N.I.T Egypt" : "AI Educational Platforms | N.I.T Egypt",
            description: "Next-gen AI educational platforms with smart learning paths and virtual assistants — built in Egypt.",
            url: `https://nitg-eg.com/${locale}/our-services/ai-educational-platforms`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function AIEducationalPlatformsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
