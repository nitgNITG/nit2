// Knowledge sources (FR-A10, §13.12). Tier 1/2 content the agent may quote:
// approved FAQ and service data (code), articles (Mongo, aiVisible). Every item
// carries a sourceId so each answer can be traced to where it came from.
import { FAQS, type FAQPageKey } from "@/lib/faqData";
import { servicesData, type ServiceKey } from "@/lib/servicesData";
import type { Locale } from "../tools/types";

/** ServiceKey → its public page under /[locale]/our-services. */
export const SERVICE_PATHS: Record<ServiceKey, string> = {
    moodle: "/our-services/moodle-lms",
    ecommerce: "/our-services/ecommerce-app",
    delivery: "/our-services/delivery-app",
    restaurant: "/our-services/restaurant-app",
    loyalty: "/our-services/loyalty-app",
    edu: "/our-services/educational-platforms",
    aiEdu: "/our-services/ai-educational-platforms",
    school: "/our-services/school-management",
    android: "/our-services/android-app",
    ios: "/our-services/ios-app",
    web: "/our-services/website-design",
};

export type KnowledgeDoc = {
    sourceId: string;
    sourceType: "faq" | "service" | "article" | "note";
    title: string;
    text: string;
    url?: string; // locale-less internal path
};

export function staticDocs(locale: Locale): KnowledgeDoc[] {
    const docs: KnowledgeDoc[] = [];
    for (const [page, faqs] of Object.entries(FAQS) as [FAQPageKey, { ar: { q: string; a: string }[]; en: { q: string; a: string }[] }][]) {
        faqs[locale].forEach((f, i) => {
            docs.push({
                sourceId: `faq:${page}:${i}`,
                sourceType: "faq",
                title: f.q,
                text: f.a,
                url: page === "home" ? "/" : SERVICE_PATHS[page as ServiceKey],
            });
        });
    }
    for (const [key, s] of Object.entries(servicesData) as [ServiceKey, (typeof servicesData)[ServiceKey]][]) {
        const ar = locale === "ar";
        docs.push({
            sourceId: `service:${key}`,
            sourceType: "service",
            title: ar ? s.headingAr : s.headingEn,
            text: [
                ar ? s.subtitleAr : s.subtitleEn,
                ...s.offerings.map((o) => `${ar ? o.titleAr : o.titleEn}: ${ar ? o.descAr : o.descEn}`),
            ].join("\n"),
            url: SERVICE_PATHS[key],
        });
    }
    return docs;
}

/** One line per service for the cached core prompt. */
export function servicesSummary(locale: Locale): string {
    return (Object.entries(servicesData) as [ServiceKey, (typeof servicesData)[ServiceKey]][])
        .map(([key, s]) => `- ${locale === "ar" ? s.headingAr : s.headingEn} (${SERVICE_PATHS[key]})`)
        .join("\n");
}

/** Topic hint for a page path — the PATH only; page text never goes to the model. */
export function pageTopic(path: string | null | undefined): string | null {
    if (!path) return null;
    const p = path.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
    if (p.startsWith("/our-services/moodle-lms") || p.startsWith("/moodle-lms")) return "eLearning / Moodle LMS";
    if (p.includes("educational") || p.includes("school")) return "eLearning platforms";
    if (p.includes("ecommerce")) return "e-commerce";
    if (p.includes("android") || p.includes("ios") || p.endsWith("-app")) return "mobile apps";
    if (p.startsWith("/pricing")) return "pricing and plans";
    if (p.startsWith("/build-product")) return "buying an academy or store";
    if (p.startsWith("/our-projects")) return "previous projects";
    if (p.startsWith("/blog")) return "blog article";
    return null;
}
