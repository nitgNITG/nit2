import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import clsx from "clsx";
import Script from "next/script";

const cairo = Cairo({ subsets: ["latin", "arabic"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://nitg-eg.com"),
  title: {
    default: "N.I.T Egypt — شركة برمجة مواقع وتطبيقات | National Software Engineering",
    template: "%s | N.I.T Egypt",
  },
  description:
    "الشركة الوطنية لهندسة البرمجيات — متخصصون في تطوير منصات Moodle التعليمية وتطبيقات التجارة الإلكترونية لمصر والخليج منذ 2013. N.I.T Egypt: Moodle LMS & eCommerce app development since 2013.",
  keywords:
    "برمجة مواقع مصر, تطوير تطبيقات, منصة مودل, تجارة إلكترونية, شركة برمجة مصر, Moodle LMS Egypt, eCommerce app development Egypt, software engineering Egypt, educational platform",
  authors: [{ name: "N.I.T Egypt", url: "https://nitg-eg.com" }],
  creator: "N.I.T Egypt",
  publisher: "N.I.T Egypt",
  icons: { icon: "/logo.svg" },
  openGraph: {
    siteName: "N.I.T Egypt",
    type: "website",
    locale: "ar_EG",
    alternateLocale: ["en_US"],
    images: [{ url: "/logo.svg", width: 512, height: 512, alt: "N.I.T Egypt Logo" }],
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
              url: "https://nitg-eg.com",
              logo: "https://nitg-eg.com/logo.svg",
              foundingDate: "2013",
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
          type="module"
          crossOrigin="anonymous"
          id="IsharatJSWidget"
          data-icon="bottom-20,right-20"
          data-key="68f64ee820c34"
          src="https://jswidget.isharat.net/script-dga-kfu-v1.3.js"
        />
      </body>
    </html>
  );
}
