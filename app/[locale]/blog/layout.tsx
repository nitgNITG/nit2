import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr ? "المدونة | مقالات Moodle والتجارة الإلكترونية — N.I.T Egypt" : "Blog | Moodle LMS & eCommerce Articles — N.I.T Egypt",
        description: isAr
            ? "مقالات ودليل شامل حول منصات Moodle التعليمية، تطبيقات التجارة الإلكترونية، التعلم الإلكتروني والتحول الرقمي في مصر والخليج."
            : "Articles and guides on Moodle LMS development, eCommerce apps, e-learning platforms, and digital transformation for Egypt and Gulf businesses.",
        keywords: "Moodle blog, e-learning articles, eCommerce Egypt blog, مدونة تقنية, تعليم إلكتروني, منصة مودل, تجارة إلكترونية مصر",
        alternates: {
            canonical: `https://nitg-eg.com/${locale}/blog`,
            languages: {
                ar: "https://nitg-eg.com/ar/blog",
                en: "https://nitg-eg.com/en/blog",
            },
        },
        openGraph: {
            title: isAr ? "المدونة | N.I.T Egypt" : "Blog | N.I.T Egypt",
            description: isAr
                ? "مقالات متخصصة في Moodle والتجارة الإلكترونية والتحول الرقمي"
                : "Expert articles on Moodle LMS, eCommerce development, and digital transformation.",
            url: `https://nitg-eg.com/${locale}/blog`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
