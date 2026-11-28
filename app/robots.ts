import { MetadataRoute } from "next";

const LOCALES = ["ar", "en"] as const;

// Private, signed-in pages — they live under the locale prefix.
const PRIVATE_PAGES = ["dashboard/", "account", "payment/"];

// Public pages load this data from /api at render time (projects, sponsors,
// pricing). Crawlers must be able to fetch it, or that content is invisible to
// them; every other /api route stays blocked. Longest match wins, so these
// Allow lines beat "Disallow: /api/".
const PUBLIC_DATA_APIS = ["/api/project", "/api/sponser", "/api/plans", "/api/licenses", "/api/public-settings"];

// Only app/robots.ts serves /robots.txt — don't add a public/robots.txt, it
// silently shadows this file in production.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", ...PUBLIC_DATA_APIS],
                disallow: ["/api/", ...LOCALES.flatMap(l => PRIVATE_PAGES.map(p => `/${l}/${p}`))],
            },
        ],
        sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.nitg-eg.com"}/sitemap.xml`,
    };
}
