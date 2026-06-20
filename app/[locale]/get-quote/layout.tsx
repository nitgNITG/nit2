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
            ? "طلب عرض سعر | تطوير Moodle وتطبيقات | N.I.T Egypt"
            : "Get a Quote | Moodle LMS & eCommerce | N.I.T Egypt",
        description: isAr
            ? "احصل على عرض سعر مجاني لمشروعك من الشركة الوطنية N.I.T Egypt. تطوير منصات Moodle، تطبيقات التجارة الإلكترونية، وبرمجة مخصصة لمصر والخليج."
            : "Get a free project quote from N.I.T Egypt. We develop Moodle LMS platforms, eCommerce apps, and custom software for Egypt and the Gulf region.",
        keywords: "get quote NIT Egypt, عرض سعر برمجة, Moodle quote, eCommerce app quote Egypt, Gulf software quote, طلب سعر",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/get-quote`,
            languages: {
                ar: "https://nitg-eg.com/ar/get-quote",
                en: "https://nitg-eg.com/en/get-quote",
            },
        },
        openGraph: {
            title: isAr ? "طلب عرض سعر | N.I.T Egypt" : "Get a Quote | N.I.T Egypt",
            description: isAr
                ? "عرض سعر مجاني ✓ بدون التزام ✓ رد خلال 24 ساعة"
                : "Free quote ✓ No obligation ✓ Reply within 24 hours",
            url: `https://nitg-eg.com/${locale}/get-quote`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://nitg-eg.com/logo.svg", width: 512, height: 512, alt: "N.I.T Egypt" }],
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
