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
            ? "مشاريعنا | منصات Moodle وتطبيقات التجارة الإلكترونية | الشركة الوطنية NIT"
            : "Our Projects | Moodle LMS & eCommerce Apps | N.I.T Egypt",
        description: isAr
            ? "شاهد أعمال الشركة الوطنية لهندسة البرمجيات: منصات Moodle التعليمية، تطبيقات التجارة الإلكترونية على Google Play وApp Store. خبرة 12+ سنة وأكثر من 100 مشروع ناجح."
            : "Explore N.I.T Egypt's portfolio: live Moodle LMS platforms, eCommerce apps on Google Play & App Store, custom software solutions for Egypt and Gulf markets. 12+ years, 100+ projects.",
        keywords: "مشاريع برمجية مصر, منصة Moodle, تطبيق تجارة إلكترونية, منصة تعليمية, ecommerce app egypt, moodle lms development, educational platform egypt",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/our-projects`,
            languages: {
                ar: "https://nitg-eg.com/ar/our-projects",
                en: "https://nitg-eg.com/en/our-projects",
            },
        },
        openGraph: {
            title: isAr ? "مشاريعنا | الشركة الوطنية NIT" : "Our Projects | Moodle LMS & eCommerce Apps | N.I.T Egypt",
            description: isAr
                ? "منصات Moodle وتطبيقات التجارة الإلكترونية — 100+ مشروع ناجح لمصر والخليج"
                : "Live Moodle LMS platforms & eCommerce apps built for Egypt and Gulf clients. 100+ projects.",
            url: `https://nitg-eg.com/${locale}/our-projects`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
        twitter: {
            card: "summary_large_image",
            title: "Our Projects | N.I.T Egypt — Moodle LMS & eCommerce",
            description: "Live Moodle platforms & eCommerce apps built by N.I.T Egypt. 100+ projects, 12+ years experience.",
        },
    };
}

export default function OurProjectsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <SocialMedia />
        </>
    );
}
