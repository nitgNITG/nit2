import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "منصات تعليم بالذكاء الاصطناعي"
            : "AI Educational Platforms",
        description: isAr
            ? "تطوير منصات تعليمية تعتمد على الذكاء الاصطناعي في مصر والخليج. توفير مسارات تعلم ذكية، تحليل أداء الطلاب ومساعدين افتراضيين للتعليم."
            : "AI-powered educational platform development in Egypt & the Gulf. Smart learning paths, student performance analytics, and virtual teaching assistants.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/ai-educational-platforms`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/ai-educational-platforms",
                en: "https://www.nitg-eg.com/en/our-services/ai-educational-platforms",
            },
        },
        openGraph: {
            title: isAr ? "منصات تعليم بالذكاء الاصطناعي | N.I.T Egypt" : "AI Educational Platforms | N.I.T Egypt",
            description: "Next-gen AI educational platforms with smart learning paths and virtual assistants — built in Egypt.",
            url: `https://www.nitg-eg.com/${locale}/our-services/ai-educational-platforms`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function AIEducationalPlatformsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "AI Educational Platform Development",
                        alternateName: "تطوير منصات التعليم بالذكاء الاصطناعي",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "AI-powered educational platforms with smart learning paths, student analytics, and virtual teaching assistants for universities and enterprises.",
                        serviceType: "AI E-Learning Platform Development",
                        url: "https://www.nitg-eg.com/en/our-services/ai-educational-platforms",
                    }),
                }}
            />
        </>
    );
}
