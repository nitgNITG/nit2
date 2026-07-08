import type { Metadata } from "next";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const isAr = locale === "ar";
    return {
        title: isAr
            ? "نظام إدارة المدارس"
            : "School Management System",
        description: isAr
            ? "تطوير نظام إدارة مدارس متكامل للمدارس والحضانات في مصر والخليج. معلومات الطلاب، الحضور، الجداول، الدرجات، الرسوم والمدفوعات الإلكترونية، وتطبيق لأولياء الأمور والمعلمين."
            : "Custom school management system development for schools & nurseries in Egypt & the Gulf. Student information, attendance, timetables, grades, fees & online payments, and a parent & teacher app.",
        alternates: {
            canonical: `https://www.nitg-eg.com/${locale}/our-services/school-management`,
            languages: {
                ar: "https://www.nitg-eg.com/ar/our-services/school-management",
                en: "https://www.nitg-eg.com/en/our-services/school-management",
            },
        },
        openGraph: {
            title: isAr ? "نظام إدارة المدارس | N.I.T Egypt" : "School Management System | N.I.T Egypt",
            description: "Custom school management systems with student records, fees, grades and a parent app — built in Egypt since 2013.",
            url: `https://www.nitg-eg.com/${locale}/our-services/school-management`,
            type: "website",
            locale: isAr ? "ar_EG" : "en_US",
        },
    };
}

export default function SchoolManagementLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Service",
                        name: "School Management System Development",
                        alternateName: "تطوير نظام إدارة المدارس",
                        provider: { "@type": "Organization", name: "N.I.T Egypt", url: "https://www.nitg-eg.com" },
                        areaServed: ["EG", "SA", "AE", "KW", "QA", "BH", "OM"],
                        description: "Custom school management systems with student information, attendance, grades, fees and online payments, and a parent & teacher mobile app.",
                        serviceType: "School Management System Development",
                        url: "https://www.nitg-eg.com/en/our-services/school-management",
                    }),
                }}
            />
        </>
    );
}
