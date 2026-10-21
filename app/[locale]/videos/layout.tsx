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
            ? "معرض الفيديوهات | استعراض مشاريع وتطبيقات N.I.T"
            : "Videos & Promos | N.I.T Apps & Software Showcase",
        description: isAr
            ? "شاهد بالفيديو عروضاً حية ومشاريع واقعية لمنصات Moodle وتطبيقات التجارة الإلكترونية والتوصيل وأنظمة الولاء التي طورتها شركة N.I.T."
            : "Watch real project promos, video walk-throughs, and live demos of Moodle LMS, eCommerce mobile apps, and enterprise systems by N.I.T.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/videos`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/videos",
                en: "https://www.nitg-eg.com/en/videos",
            },
        },
        openGraph: {
            title: isAr ? "معرض الفيديوهات | N.I.T Egypt" : "Videos & Promos | N.I.T Egypt",
            description: isAr
                ? "عروض فيديو حية لمشاريعنا وتطبيقاتنا البرمجية في مصر والخليج"
                : "Live video walk-throughs and promos of our software projects in Egypt and the Gulf.",
            url: `https://www.nitg-eg.com/${locale}/videos`,
            type: "video.other",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/og-image.png", width: 1200, height: 630, alt: "N.I.T Egypt Videos" }],
        },
        twitter: {
            card: "summary_large_image",
            title: isAr ? "معرض الفيديوهات | N.I.T Egypt" : "Videos Showcase | N.I.T Egypt",
            description: isAr
                ? "عروض فيديو حية لمشاريعنا وتطبيقاتنا البرمجية"
                : "Live video walk-throughs and promos of our software projects.",
        },
    };
}

export default function VideosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
