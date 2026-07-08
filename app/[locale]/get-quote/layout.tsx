import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "طلب عرض سعر | تطوير Moodle وتطبيقات"
            : "Get a Quote | Moodle LMS & eCommerce",
        description: isAr
            ? "احصل على عرض سعر مجاني لمشروعك من الشركة الوطنية N.I.T Egypt. تطوير منصات Moodle، تطبيقات التجارة الإلكترونية، وبرمجة مخصصة لمصر والخليج."
            : "Get a free project quote from N.I.T Egypt. We develop Moodle LMS platforms, eCommerce apps, and custom software for Egypt and the Gulf region.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/get-quote`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/get-quote",
                en: "https://www.nitg-eg.com/en/get-quote",
            },
        },
        openGraph: {
            title: isAr ? "طلب عرض سعر | N.I.T Egypt" : "Get a Quote | N.I.T Egypt",
            description: isAr
                ? "عرض سعر مجاني ✓ بدون التزام ✓ رد خلال 24 ساعة"
                : "Free quote ✓ No obligation ✓ Reply within 24 hours",
            url: `https://www.nitg-eg.com/${locale}/get-quote`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: isAr ? "طلب عرض سعر | N.I.T Egypt" : "Get a Quote | N.I.T Egypt",
            description: isAr
                ? "عرض سعر مجاني — رد خلال 24 ساعة"
                : "Free project quote — Reply within 24 hours",
        },
    };
}

export default function GetQuoteLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
