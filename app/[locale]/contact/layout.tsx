import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export const metadata: Metadata = {
    title: "Contact Us | تواصل معنا — N.I.T Egypt",
    description: "Contact N.I.T Egypt for Moodle LMS development, eCommerce apps, and website programming. Call +201091568240 or email info@nitg-eg.com. 168 King Faisal St, Giza. تواصل مع الشركة الوطنية لهندسة البرمجيات.",
    keywords: "contact NIT Egypt, تواصل معنا, شركة برمجة مصر, Moodle development contact, eCommerce app Egypt, info@nitg-eg.com, +201091568240",
    alternates: {
        canonical: "https://nitg-eg.com/ar/contact",
        languages: {
            ar: "https://nitg-eg.com/ar/contact",
            en: "https://nitg-eg.com/en/contact",
        },
    },
    openGraph: {
        title: "Contact N.I.T Egypt | تواصل معنا",
        description: "Get in touch with N.I.T Egypt — Moodle LMS & eCommerce app specialists. Phone: +201091568240 | Email: info@nitg-eg.com | Giza, Egypt.",
        url: "https://nitg-eg.com/en/contact",
        type: "website",
    },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
