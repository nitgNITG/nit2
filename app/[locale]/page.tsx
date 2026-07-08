import type { Metadata } from "next";
import FAQSchema from "./components/FAQSchema";
import FAQSection from "./components/FAQSection";
import Header from "./components/Header";
import OurServices from "./components/OurServices";
import Sponsors from "./components/Sponsors";
import Experience from "./components/Experience";
import Projects from "./components/Projects";
import Platforms from "./components/Platforms";
import ProjectsCost from "./components/ProjectsCost";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import Location from "./components/Location";
import SocialMedia from "./components/SocialMedia";
import DownSide from "./components/DownSide";
import ServiceCards from "./components/ServiceCards";
import HomepageServices from "./components/HomepageServices";
import HomepageBlog from "./components/HomepageBlog";
import GovernmentProjects from "./components/GovernmentProjects";
import ScrollReveal from "./components/ScrollReveal";

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const isAr = locale === "ar";
  return {
    title: isAr
      ? "الشركة الوطنية لهندسة البرمجيات | برمجة مواقع وتطبيقات مصر والخليج"
      : { absolute: "N.I.T Egypt | Moodle LMS & eCommerce App Development Since 2013" },
    description: isAr
      ? "الشركة الوطنية لهندسة البرمجيات وتكنولوجيا المعلومات — أفضل شركة برمجة في مصر. نطوّر منصات Moodle التعليمية، تطبيقات التوصيل والمطاعم، المتاجر الإلكترونية، وأنظمة ولاء العملاء لمصر والخليج منذ 2013."
      : "Egypt's leading software company building Moodle LMS platforms, delivery & restaurant apps, eCommerce stores and customer loyalty systems for Egypt and the Gulf. 100+ projects, 12+ years since 2013.",
    alternates: {
      canonical: `https://www.nitg-eg.com/${locale}`,
      languages: { ar: "https://www.nitg-eg.com/ar", en: "https://www.nitg-eg.com/en" },
    },
    openGraph: {
      title: isAr ? "الشركة الوطنية لهندسة البرمجيات | N.I.T Egypt" : "N.I.T Egypt — Moodle LMS & eCommerce App Development",
      description: isAr
        ? "أفضل شركة برمجة في مصر — منصات Moodle التعليمية وتطبيقات التجارة الإلكترونية منذ 2013"
        : "Egypt's top Moodle LMS & eCommerce app developer. 100+ live projects for Egypt and Gulf clients.",
      url: `https://www.nitg-eg.com/${locale}`,
      locale: isAr ? "ar_EG" : "en_US",
    },
  };
}

export default function Home() {
  return (
    <div className="overflow-y-hidden">
      <FAQSchema page="home" />
      <Header />
      <ScrollReveal><OurServices /></ScrollReveal>
      <ScrollReveal><ServiceCards /></ScrollReveal>
      <ScrollReveal><HomepageServices /></ScrollReveal>
      <ScrollReveal><GovernmentProjects /></ScrollReveal>
      <ScrollReveal><Sponsors /></ScrollReveal>
      <ScrollReveal><Experience /></ScrollReveal>
      <ScrollReveal><Projects /></ScrollReveal>
      <ScrollReveal><Platforms /></ScrollReveal>
      <ScrollReveal><ProjectsCost /></ScrollReveal>
      <ScrollReveal><HomepageBlog /></ScrollReveal>
      <ScrollReveal><FAQSection page="home" /></ScrollReveal>
      <ScrollReveal><Contact key="home-contact" /></ScrollReveal>
      <ScrollReveal><Location /></ScrollReveal>
      <Footer />
      <SocialMedia />
      <DownSide />
    </div>
  );
}
