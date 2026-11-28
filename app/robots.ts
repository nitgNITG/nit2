import { MetadataRoute } from "next";

const LOCALES = ["ar", "en"] as const;

// Private, signed-in pages — they live under the locale prefix.
const PRIVATE_PAGES = ["dashboard/", "account", "payment/"];

// Public pages load this data from /api at render time (projects, sponsors,
// pricing). Crawlers must be able to fetch it, or that content is invisible to
// them; every other /api route stays blocked. Longest match wins, so these
// Allow lines beat "Disallow: /api/".
const PUBLIC_DATA_APIS = ["/api/project", "/api/sponser", "/api/plans", "/api/licenses", "/api/public-settings"];

// AI search / assistant crawlers (and the Google / Apple AI-use tokens) — ALLOWED on
// purpose: the business wants to be found and cited by ChatGPT, Claude, Perplexity,
// Gemini and Apple Intelligence. Bingbot also feeds Copilot and ChatGPT search.
// They get explicit groups so that stance is visible and survives a future "*" change.
// To opt one out, give it `disallow: ["/"]` instead of the shared rules.
export const AI_AND_SEARCH_CRAWLERS = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",              // OpenAI: training, ChatGPT search, user fetches
    "ClaudeBot", "Claude-SearchBot", "Claude-User",         // Anthropic
    "PerplexityBot", "Perplexity-User",                     // Perplexity
    "Google-Extended",                                      // Gemini / Vertex AI use (token, not a crawler)
    "Applebot-Extended",                                    // Apple Intelligence use (token, not a crawler)
    "Bingbot",                                              // Bing, Copilot, ChatGPT search index
] as const;

// Only app/robots.ts serves /robots.txt — don't add a public/robots.txt, it
// silently shadows this file in production.
export default function robots(): MetadataRoute.Robots {
    const allow = ["/", ...PUBLIC_DATA_APIS];
    const disallow = ["/api/", ...LOCALES.flatMap(l => PRIVATE_PAGES.map(p => `/${l}/${p}`))];
    return {
        rules: [
            { userAgent: "*", allow, disallow },
            // A crawler obeys ONLY its most specific group, so each named group must
            // repeat every Allow/Disallow line — otherwise it would ignore the "*" ones.
            ...AI_AND_SEARCH_CRAWLERS.map(userAgent => ({ userAgent, allow: [...allow], disallow: [...disallow] })),
        ],
        sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.nitg-eg.com"}/sitemap.xml`,
    };
}
