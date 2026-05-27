import type { Metadata } from "next";
import SocialMedia from "../components/SocialMedia";

export const metadata: Metadata = {
    title: "About Us | من نحن — N.I.T Egypt",
    description: "Learn about N.I.T Egypt — National Software Engineering & IT company founded in 2013 in Cairo. Specialists in Moodle LMS, eCommerce apps, and educational platforms for Egypt and the Gulf. تعرف على الشركة الوطنية لهندسة البرمجيات وتكنولوجيا المعلومات.",
    keywords: "about NIT Egypt, شركة برمجة مصر, الشركة الوطنية لهندسة البرمجيات, software company Egypt, من نحن, NIT Egypt history",
    alternates: {
        canonical: "https://nitg-eg.com/ar/who-us",
        languages: {
            ar: "https://nitg-eg.com/ar/who-us",
            en: "https://nitg-eg.com/en/who-us",
        },
    },
    openGraph: {
        title: "About N.I.T Egypt | من نحن — الشركة الوطنية لهندسة البرمجيات",
        description: "Founded in Cairo 2013. N.I.T Egypt builds Moodle LMS platforms and eCommerce apps for universities, enterprises and merchants across Egypt and the Gulf.",
        url: "https://nitg-eg.com/en/who-us",
        type: "website",
    },
};

export default function WhoUsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            {children}
            <SocialMedia />
        </div>
    );
}
