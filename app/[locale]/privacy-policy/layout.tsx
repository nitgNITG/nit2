import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr ? "سياسة الخصوصية | N.I.T Egypt" : "Privacy Policy | N.I.T Egypt",
        description: isAr
            ? "سياسة الخصوصية لشركة N.I.T Egypt — كيف نجمع بياناتك ونحميها ونستخدمها."
            : "Privacy Policy for N.I.T Egypt — how we collect, protect, and use your data.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/privacy-policy`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/privacy-policy",
                en: "https://www.nitg-eg.com/en/privacy-policy",
            },
        },
        robots: { index: true, follow: true },
    };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebPage",
                        "@id": "https://www.nitg-eg.com/ar/privacy-policy",
                        name: "سياسة الخصوصية — N.I.T Egypt",
                        url: "https://www.nitg-eg.com/ar/privacy-policy",
                        description: "سياسة الخصوصية لشركة الشركة الوطنية لهندسة البرمجيات",
                        publisher: {
                            "@type": "Organization",
                            name: "N.I.T Egypt",
                            url: "https://www.nitg-eg.com",
                        },
                        inLanguage: ["ar", "en"],
                    }),
                }}
            />
        </>
    );
}
