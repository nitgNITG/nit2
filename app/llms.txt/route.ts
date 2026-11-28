import { isThinArticle, publishedWhere } from "@/lib/blog";
import prisma from "@/prisma/client";

// /llms.txt — an llmstxt.org-style Markdown map of the site for AI assistants
// (ChatGPT, Claude, Perplexity, Gemini …): who N.I.T is, the service pages in both
// languages, projects, contact, and the newest real articles. Rebuilt hourly like
// the sitemap. Not a ranking signal — just a clean, citable summary for any tool
// that reads it. Outside the next-intl middleware matcher, so no locale redirect.
export const revalidate = 3600;

const ARTICLE_LIMIT = 30;

const SERVICES: { slug: string; name: string; note: string }[] = [
    { slug: "moodle-lms", name: "Moodle LMS development", note: "Custom Moodle platforms, themes, plugins, hosting and support for academies, universities and companies" },
    { slug: "educational-platforms", name: "Educational platforms", note: "E-learning platforms and online academies for teachers, centres and training providers" },
    { slug: "ai-educational-platforms", name: "AI educational platforms", note: "Learning platforms with AI tutoring, content generation and assessment" },
    { slug: "school-management", name: "School management systems", note: "Students, staff, fees, timetables and parent communication" },
    { slug: "ecommerce-app", name: "E-commerce development", note: "Online stores, multi-vendor marketplaces and shopping apps" },
    { slug: "delivery-app", name: "Delivery app development", note: "Customer, driver and admin apps for delivery and logistics" },
    { slug: "restaurant-app", name: "Restaurant apps & POS", note: "Ordering apps, menus, POS and kitchen systems for restaurants" },
    { slug: "loyalty-app", name: "Loyalty & rewards systems", note: "Points, rewards and customer-retention apps" },
    { slug: "android-app", name: "Android app development", note: "Native and cross-platform Android apps" },
    { slug: "ios-app", name: "iPhone app development", note: "iOS apps for iPhone and iPad" },
    { slug: "website-design", name: "Website design & development", note: "Bilingual Arabic/English (RTL) websites" },
];

/** Escape what would end or break a Markdown link label. */
const label = (s: string) => s.replace(/[\\[\]]/g, (c) => `\\${c}`).replace(/\s+/g, " ").trim();

/** One entry per page: the English URL as the link, the Arabic one alongside. */
const bilingual = (base: string, path: string, name: string, note?: string) =>
    `- [${name}](${base}/en${path})${note ? `: ${note}.` : ":"} Arabic: [${name} (عربي)](${base}/ar${path})`;

async function latestArticles(base: string): Promise<string[]> {
    try {
        const articles = await prisma.article.findMany({
            where: publishedWhere(),
            select: { id: true, slug: true, title: true, titleEn: true, publishedAt: true, Section: { select: { id: true } } },
            orderBy: { publishedAt: "desc" },
        });
        return articles
            .filter((a) => !isThinArticle(a))
            .slice(0, ARTICLE_LIMIT)
            .map((a) => `- [${label(a.titleEn ?? a.title)}](${base}/en/blog/${encodeURIComponent(a.slug ?? a.id)})`);
    } catch {
        return []; // DB unavailable — serve the static part only
    }
}

function buildLlmsTxt(base: string, articles: string[]): string {
    const out = [
        "# N.I.T Egypt",
        "",
        "> N.I.T Egypt (National Software Engineering, الشركة الوطنية لهندسة البرمجيات) is a software company in Giza, Egypt, building since 2013: Moodle LMS and e-learning platforms for academies, schools and companies, plus e-commerce stores and marketplaces, delivery, restaurant and loyalty apps, and Android/iOS apps — bilingual Arabic/English with full RTL support, for clients in Egypt, the Gulf (Saudi Arabia, UAE, Kuwait, Qatar), the UK and Canada.",
        "",
        `Every page exists in Arabic (/ar, the default) and English (/en). Contact: info@nitg-eg.com, +201091568240 (WhatsApp/phone), +201149830855 (sales).`,
        "",
        "## Services",
        "",
        ...SERVICES.map((s) => bilingual(base, `/our-services/${s.slug}`, s.name, s.note)),
        "",
        "## Our Projects",
        "",
        bilingual(base, "/our-projects", "Our projects", "Portfolio of live LMS, e-commerce, delivery and restaurant projects"),
        "",
        "## Contact",
        "",
        bilingual(base, "/contact", "Contact us", "Phone, WhatsApp, email and office address"),
        bilingual(base, "/get-quote", "Get a quote", "Request a price for a project"),
        bilingual(base, "/who-us", "About N.I.T"),
    ];
    if (articles.length) out.push("", "## Latest articles", "", ...articles);
    out.push("", "## Optional", "", bilingual(base, "/blog", "Blog"), bilingual(base, "/videos", "Videos"), `- [Sitemap](${base}/sitemap.xml)`, "");
    return out.join("\n");
}

export async function GET(): Promise<Response> {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.nitg-eg.com";
    return new Response(buildLlmsTxt(base, await latestArticles(base)), {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
}
