import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/dashboard/", "/api/"],
            },
        ],
        sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.nitg-eg.com"}/sitemap.xml`,
    };
}
