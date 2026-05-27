import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export const metadata: Metadata = {
    title: "Blog | المدونة — N.I.T Egypt",
    description: "Articles and guides on Moodle LMS development, eCommerce apps, e-learning platforms, and digital transformation for Egypt and Gulf businesses. مقالات ودليل شامل حول منصات Moodle والتجارة الإلكترونية.",
    keywords: "Moodle blog, e-learning articles, eCommerce Egypt blog, مدونة تقنية, تعليم إلكتروني, منصة مودل, تجارة إلكترونية مصر, digital transformation Egypt",
    alternates: {
        canonical: "https://nitg-eg.com/ar/blog",
        languages: {
            ar: "https://nitg-eg.com/ar/blog",
            en: "https://nitg-eg.com/en/blog",
        },
    },
    openGraph: {
        title: "Blog | المدونة — N.I.T Egypt",
        description: "Expert articles on Moodle LMS, eCommerce development, e-learning strategies and digital transformation from N.I.T Egypt's team.",
        url: "https://nitg-eg.com/en/blog",
        type: "website",
    },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
