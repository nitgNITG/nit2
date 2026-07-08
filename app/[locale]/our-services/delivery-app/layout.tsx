import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "تطوير تطبيقات التوصيل وطلب الطعام"
            : "Delivery App Development",
        description: isAr
            ? "تطوير تطبيقات توصيل طلبات في مصر والخليج — مثل مرسول وهنقرستيشن وجاهز. تطبيق عميل وسائق، تتبع مباشر بالخريطة، بوابات دفع، ولوحة تحكم متكاملة."
            : "Custom delivery app development in Egypt & the Gulf — like Mrsool, HungerStation & Jahez. Customer & driver apps, live GPS tracking, payment gateways and a full admin dashboard.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/delivery-app`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/delivery-app",
                en: "https://www.nitg-eg.com/en/our-services/delivery-app",
            },
        },
        openGraph: {
            title: "Delivery App Development | N.I.T Egypt",
            description: "On-demand delivery apps like Mrsool, HungerStation & Jahez — customer & driver apps, live tracking and admin dashboard. Built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/delivery-app`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "Delivery App Development — N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: "Delivery App Development | N.I.T Egypt",
            description: "Customer & driver delivery apps with live GPS tracking — built in Egypt since 2013.",
        },
    };
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "Delivery App Development",
                        alternateName: "تطوير تطبيقات التوصيل",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "On-demand delivery apps with customer and driver apps, live GPS tracking, payment gateway integration and a full admin dashboard.",
                        serviceType: "On-Demand Delivery App Development",
                        url: "https://www.nitg-eg.com/en/our-services/delivery-app",
                    }),
                }}
            />
        </>
    );
}
