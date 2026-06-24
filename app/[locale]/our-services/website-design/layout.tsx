import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "شركة تطوير مواقع الإنترنت | N.I.T Egypt"
            : "Web Development | N.I.T Egypt",
        description: isAr
            ? "تطوير وبرمجة مواقع الإنترنت في مصر والخليج. مواقع شركات وصفحات هبوط ومتاجر وتطبيقات ويب — متجاوبة، سريعة، ومهيأة لمحركات البحث SEO مع نظام إدارة محتوى."
            : "Custom web development in Egypt & the Gulf. Corporate sites, landing pages, stores and web apps — responsive, fast and SEO-ready with a CMS.",
        keywords: "website design Egypt, web development Egypt, تصميم مواقع, تصميم مواقع انترنت, شركة تصميم مواقع, تصميم موقع شركة, صفحات هبوط, web app development, SEO website Egypt, تكلفة تصميم موقع",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/our-services/website-design`,
            languages: {
                ar: "https://nitg-eg.com/ar/our-services/website-design",
                en: "https://nitg-eg.com/en/our-services/website-design",
            },
        },
        openGraph: {
            title: "Website Design & Development | N.I.T Egypt",
            description: "Responsive, SEO-ready websites and web apps — corporate sites, landing pages and dashboards. Built in Egypt since 2013.",
            url: `https://nitg-eg.com/${locale}/our-services/website-design`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://nitg-eg.com/logo.svg", width: 512, height: 512, alt: "Website Design & Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Website Design & Development | N.I.T Egypt",
            description: "Responsive, SEO-ready websites and web apps — built in Egypt since 2013.",
        },
    };
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Website Design & Development",
                        alternateName: "تصميم مواقع الإنترنت",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Responsive, SEO-friendly website design and development — corporate sites, landing pages, stores and custom web apps.",
                        serviceType: "Website Design & Development",
                        url: "https://nitg-eg.com/en/our-services/website-design",
                    }),
                }}
            />
        </>
    );
}
