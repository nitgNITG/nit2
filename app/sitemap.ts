import { MetadataRoute } from "next";
import prisma from "@/prisma/client";

const BASE_URL = "https://nitg-eg.com";
const locales = ["ar", "en"];

const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/our-projects", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/our-services/moodle-lms", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/our-services/ecommerce-app", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/our-services/delivery-app", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/our-services/restaurant-app", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/our-services/loyalty-app", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/blog", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/who-us", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/get-quote", priority: 0.8, changeFrequency: "monthly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    // Static pages — one entry per locale
    const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap(({ path, priority, changeFrequency }) =>
        locales.map((locale) => ({
            url: `${BASE_URL}/${locale}${path}`,
            lastModified: now,
            changeFrequency,
            priority,
        }))
    );

    // Blog articles
    let articleEntries: MetadataRoute.Sitemap = [];
    try {
        const articles = await prisma.article.findMany({
            select: { id: true, slug: true, publishedAt: true },
            orderBy: { publishedAt: "desc" },
        });

        articleEntries = articles.flatMap((article) =>
            locales.map((locale) => ({
                // Use SEO-friendly slug when available, fall back to MongoDB id
                url: `${BASE_URL}/${locale}/blog/${article.slug ?? article.id}`,
                lastModified: article.publishedAt ?? now,
                changeFrequency: "monthly" as const,
                priority: 0.6,
            }))
        );
    } catch {
        // DB unavailable at build time — skip articles
    }

    return [...staticEntries, ...articleEntries];
}
