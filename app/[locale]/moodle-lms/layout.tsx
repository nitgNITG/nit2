import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: "Moodle LMS Development | تطوير منصات Moodle | N.I.T Egypt",
        description: isAr
            ? "تطوير منصات Moodle التعليمية في مصر والخليج منذ 2013. منصات مخصصة للجامعات والمدارس والشركات مع دعم اللغة العربية RTL وتطبيقات الجوال والاستضافة المُدارة."
            : "Custom Moodle LMS development in Egypt and Gulf countries since 2013. Universities, schools & corporate training platforms with Arabic RTL support, mobile apps, and managed hosting.",
        keywords: "Moodle LMS Egypt, Moodle development, e-learning platform Egypt, Moodle Arabic RTL, منصة مودل, تعليم إلكتروني, منصة تعليمية مصر, تطوير Moodle الخليج, educational LMS",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/moodle-lms`,
            languages: {
                ar: "https://nitg-eg.com/ar/moodle-lms",
                en: "https://nitg-eg.com/en/moodle-lms",
            },
        },
        openGraph: {
            title: "Moodle LMS Development | N.I.T Egypt",
            description: "Expert Moodle LMS development since 2013. Live platforms for universities, schools & enterprises in Egypt and the Gulf. Arabic RTL, mobile apps, managed hosting.",
            url: `https://nitg-eg.com/${locale}/moodle-lms`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://nitg-eg.com/logo.svg", width: 512, height: 512, alt: "Moodle LMS Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Moodle LMS Development | N.I.T Egypt",
            description: "Custom Moodle platforms for Egypt & Gulf — Arabic RTL, mobile apps, 50+ live deployments.",
        },
    };
}

export default function MoodleLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Moodle LMS Development",
                        alternateName: "تطوير منصات Moodle التعليمية",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Custom Moodle LMS platforms for universities, schools and enterprises with Arabic RTL support, mobile app integration, and managed hosting.",
                        serviceType: "E-Learning Platform Development",
                        url: "https://nitg-eg.com/en/moodle-lms",
                    }),
                }}
            />
        </>
    );
}
