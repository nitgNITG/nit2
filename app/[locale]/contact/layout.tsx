import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr ? "تواصل معنا | الشركة الوطنية لهندسة البرمجيات" : "Contact Us — National Software Engineering",
        description: isAr
            ? "تواصل مع الشركة الوطنية لهندسة البرمجيات. اتصل على 201091568240+ أو راسلنا على info@nitg-eg.com. 168 شارع الملك فيصل، الجيزة، مصر."
            : "Contact N.I.T Egypt for Moodle LMS development, eCommerce apps, and website programming. Call +201091568240 or email info@nitg-eg.com. 168 King Faisal St, Giza.",
        keywords: "contact NIT Egypt, تواصل معنا, شركة برمجة مصر, Moodle development contact, eCommerce app Egypt, info@nitg-eg.com",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/contact`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/contact",
                en: "https://www.nitg-eg.com/en/contact",
            },
        },
        openGraph: {
            title: isAr ? "تواصل معنا | N.I.T Egypt" : "Contact N.I.T Egypt",
            description: isAr
                ? "اتصل بنا الآن — +201091568240 | info@nitg-eg.com | الجيزة، مصر"
                : "Get in touch — Phone: +201091568240 | Email: info@nitg-eg.com | Giza, Egypt.",
            url: `https://www.nitg-eg.com/${locale}/contact`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
            images: [{ url: "https://www.nitg-eg.com/logo.svg", width: 512, height: 512, alt: "N.I.T Egypt" }],
        },
        twitter: {
            card: "summary_large_image",
            title: isAr ? "تواصل معنا | N.I.T Egypt" : "Contact N.I.T Egypt",
            description: isAr
                ? "اتصل بنا الآن — +201091568240 | الجيزة، مصر"
                : "Get in touch — +201091568240 | Giza, Egypt.",
        },
    };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
