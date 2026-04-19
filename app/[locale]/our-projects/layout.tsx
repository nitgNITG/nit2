import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export const metadata: Metadata = {
    title: "مشاريعنا | منصات Moodle وتطبيقات التجارة الإلكترونية | الشركة الوطنية NIT",
    description: "شاهد أعمال الشركة الوطنية لهندسة البرمجيات: منصات Moodle التعليمية، تطبيقات التجارة الإلكترونية على Google Play وApp Store، ومنصات تعليمية متكاملة لمصر والخليج. خبرة 15 سنة وأكثر من 100 مشروع ناجح.",
    keywords: "مشاريع برمجية مصر, منصة Moodle, تطبيق تجارة إلكترونية, منصة تعليمية, برمجة تطبيقات الجوال, ecommerce app egypt, moodle lms development, educational platform egypt, elearning egypt gulf",
    alternates: {
        canonical: "/ar/our-projects",
        languages: {
            "ar": "/ar/our-projects",
            "en": "/en/our-projects",
        },
    },
    openGraph: {
        title: "Our Projects | Moodle LMS & eCommerce Apps | N.I.T Egypt",
        description: "Explore N.I.T's portfolio: live Moodle LMS platforms, eCommerce apps on Google Play & App Store, and custom software solutions for Egypt and Gulf markets. 15+ years, 100+ projects.",
        type: "website",
        locale: "ar_EG",
        alternateLocale: ["en_US"],
    },
    twitter: {
        card: "summary_large_image",
        title: "Our Projects | N.I.T Egypt — Moodle LMS & eCommerce",
        description: "Live Moodle platforms & eCommerce apps built by N.I.T Egypt. 100+ projects, 15+ years experience.",
    },
};

export default function OurProjectsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <SocialMedia />
        </>
    );
}
