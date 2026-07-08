import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "شركة تطوير مواقع الإنترنت"
            : "Web Development",
        description: isAr
            ? "تطوير وبرمجة مواقع الإنترنت في مصر والخليج. مواقع شركات وصفحات هبوط ومتاجر وتطبيقات ويب — متجاوبة، سريعة، ومهيأة لمحركات البحث SEO مع نظام إدارة محتوى."
            : "Custom web development in Egypt & the Gulf. Corporate sites, landing pages, stores and web apps — responsive, fast and SEO-ready with a CMS.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/website-design`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/website-design",
                en: "https://www.nitg-eg.com/en/our-services/website-design",
            },
        },
        openGraph: {
            title: "Website Design & Development | N.I.T Egypt",
            description: "Responsive, SEO-ready websites and web apps — corporate sites, landing pages and dashboards. Built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/website-design`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "Website Design & Development — N.I.T Egypt" }],
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
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Responsive, SEO-friendly website design and development — corporate sites, landing pages, stores and custom web apps.",
                        serviceType: "Website Design & Development",
                        url: "https://www.nitg-eg.com/en/our-services/website-design",
                    }),
                }}
            />
        </>
    );
}
