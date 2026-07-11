import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "animate.css";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import clsx from "clsx";
import Script from "next/script";

const cairo = Cairo({ subsets: ["latin", "arabic"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.nitg-eg.com"),
  title: {
    default: "N.I.T Egypt | شركة برمجة مواقع وتطبيقات في مصر",
    template: "%s | N.I.T Egypt",
  },
  description:
    "الشركة الوطنية لهندسة البرمجيات — نطوّر منصات Moodle التعليمية، تطبيقات التوصيل والمطاعم، المتاجر الإلكترونية، وأنظمة ولاء العملاء لمصر والخليج منذ 2013. N.I.T Egypt: LMS, delivery, restaurant, eCommerce & loyalty app development since 2013.",
  authors: [{ name: "N.I.T Egypt", url: "https://www.nitg-eg.com" }],
  creator: "N.I.T Egypt",
  publisher: "N.I.T Egypt",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    siteName: "N.I.T Egypt",
    type: "website",
    locale: "ar_EG",
    alternateLocale: ["en_US"],
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "N.I.T Egypt — حلول برمجية متكاملة لمصر والخليج" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@nitgEgypt",
  },
  robots: { index: true, follow: true },
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://jswidget.isharat.net" />
        {/* hreflang — tell Google about AR/EN alternates */}
        <link rel="alternate" hrefLang="ar" href="https://www.nitg-eg.com/ar" />
        <link rel="alternate" hrefLang="en" href="https://www.nitg-eg.com/en" />
        <link rel="alternate" hrefLang="x-default" href="https://www.nitg-eg.com/ar" />
      </head>
      <body
        className={clsx(
          `${cairo.className}`,
          { "text-left": locale == "en" },
          { "text-right": locale == "ar" }
        )}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster toastOptions={{ position: "top-right" }} />
        </NextIntlClientProvider>
        <Script
          id="org-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "N.I.T Egypt — National Software Engineering",
              alternateName: "الشركة الوطنية لهندسة البرمجيات",
              url: "https://www.nitg-eg.com",
              logo: "https://www.nitg-eg.com/og-image.png",
              foundingDate: "2013",
              knowsAbout: [
                "Moodle LMS Development",
                "E-Learning Platforms",
                "eCommerce App Development",
                "Multi-Vendor Marketplaces",
                "Delivery App Development",
                "Restaurant Apps & POS Systems",
                "Customer Loyalty & Rewards Systems",
                "Mobile App Development",
              ],
              address: {
                "@type": "PostalAddress",
                streetAddress: "168 King Faisal Street",
                addressLocality: "Giza",
                addressCountry: "EG",
              },
              contactPoint: [
                { "@type": "ContactPoint", telephone: "+201091568240", contactType: "customer service", areaServed: ["EG", "SA", "AE", "KW", "QA"], availableLanguage: ["Arabic", "English"] },
                { "@type": "ContactPoint", telephone: "+201149830855", contactType: "sales", areaServed: ["EG", "SA", "AE", "KW", "QA"], availableLanguage: ["Arabic", "English"] },
              ],
              email: "info@nitg-eg.com",
              sameAs: ["https://www.facebook.com/nitgEgypt", "https://www.linkedin.com/company/nitgEgypt"],
            }),
          }}
        />
        <Script
          id="localbusiness-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "@id": "https://www.nitg-eg.com/#localbusiness",
              name: "N.I.T Egypt — National Software Engineering",
              alternateName: "الشركة الوطنية لهندسة البرمجيات",
              url: "https://www.nitg-eg.com",
              logo: "https://www.nitg-eg.com/og-image.png",
              image: "https://www.nitg-eg.com/og-image.png",
              description: "شركة مصرية متخصصة في تطوير منصات Moodle التعليمية، تطبيقات التوصيل والمطاعم، المتاجر الإلكترونية، وأنظمة ولاء العملاء لمصر والخليج منذ 2013.",
              foundingDate: "2013",
              telephone: ["+201091568240", "+201149830855"],
              email: "info@nitg-eg.com",
              address: {
                "@type": "PostalAddress",
                streetAddress: "168 King Faisal Street",
                addressLocality: "Giza",
                addressRegion: "Giza",
                addressCountry: "EG",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 30.0120,
                longitude: 31.2050,
              },
              areaServed: [
                { "@type": "Country", name: "Egypt" },
                { "@type": "Country", name: "Saudi Arabia" },
                { "@type": "Country", name: "United Arab Emirates" },
                { "@type": "Country", name: "Kuwait" },
                { "@type": "Country", name: "Qatar" },
              ],
              priceRange: "$$",
              openingHours: "Mo-Fr 09:00-17:00",
              sameAs: [
                "https://www.facebook.com/nitgEgypt",
                "https://www.linkedin.com/company/nitgEgypt",
              ],
            }),
          }}
        />
        <Script
          strategy="afterInteractive"
          id="IsharatJSWidget"
          data-icon="bottom-20,right-20"
          data-key="68f64ee820c34"
          src="https://jswidget.isharat.net/script-dga-kfu-v1.3.js"
        />
      </body>
    </html>
  );
}
