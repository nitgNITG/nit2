import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr ? "من نحن | الشركة الوطنية لهندسة البرمجيات — N.I.T Egypt" : "About Us | N.I.T Egypt — National Software Engineering",
        description: isAr
            ? "تعرف على الشركة الوطنية لهندسة البرمجيات وتكنولوجيا المعلومات. شركة مصرية تأسست عام 2013 في القاهرة، متخصصة في تطوير منصات Moodle التعليمية وتطبيقات التجارة الإلكترونية لمصر والخليج."
            : "Learn about N.I.T Egypt — National Software Engineering & IT company founded in Cairo 2013. Specialists in Moodle LMS, eCommerce apps, and educational platforms for Egypt and the Gulf.",
        keywords: "about NIT Egypt, شركة برمجة مصر, الشركة الوطنية لهندسة البرمجيات, software company Egypt, من نحن, NIT Egypt history",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/who-us`,
            languages: {
                ar: "https://nitg-eg.com/ar/who-us",
                en: "https://nitg-eg.com/en/who-us",
            },
        },
        openGraph: {
            title: isAr ? "من نحن | الشركة الوطنية لهندسة البرمجيات" : "About N.I.T Egypt | National Software Engineering",
            description: isAr
                ? "شركة مصرية تأسست 2013 — متخصصون في منصات Moodle وتطبيقات التجارة الإلكترونية"
                : "Founded in Cairo 2013. N.I.T Egypt builds Moodle LMS platforms and eCommerce apps for Egypt and the Gulf.",
            url: `https://nitg-eg.com/${locale}/who-us`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function WhoUsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
