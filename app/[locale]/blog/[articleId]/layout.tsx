import type { Metadata } from "next";
import prisma from "@/prisma/client";

export async function generateMetadata({
    params: { articleId, locale },
}: {
    params: { articleId: string; locale: string };
}): Promise<Metadata> {
    try {
        // Look up by slug first (new SEO-friendly URLs), then fall back to id
        let article = await prisma.article.findUnique({
            where: { slug: articleId },
            select: { slug: true, title: true, titleEn: true, metaDesc: true, metaDescEn: true, img: true, publishedAt: true },
        });
        if (!article) {
            article = await prisma.article.findUnique({
                where: { id: articleId },
                select: { slug: true, title: true, titleEn: true, metaDesc: true, metaDescEn: true, img: true, publishedAt: true },
            }).catch(() => null);
        }

        if (!article) {
            return { title: "Article | N.I.T Egypt Blog" };
        }

        const isAr = locale === "ar";
        const canonical = article.slug ?? articleId;
        const title = isAr ? article.title : (article.titleEn ?? article.title);
        const description = isAr
            ? (article.metaDesc ?? "")
            : (article.metaDescEn ?? article.metaDesc ?? "");
        const imgUrl = article.img?.startsWith("/") ? `https://www.nitg-eg.com${article.img}` : article.img;

        return {
            title,
            description,
            alternates: {
                canonical: `https://www.nitg-eg.com/${locale}/blog/${canonical}`,
                languages: {
                    ar: `https://www.nitg-eg.com/ar/blog/${canonical}`,
                    en: `https://www.nitg-eg.com/en/blog/${canonical}`,
                },
            },
            openGraph: {
                title,
                description,
                url: `https://www.nitg-eg.com/${locale}/blog/${canonical}`,
                type: "article",
                publishedTime: article.publishedAt?.toISOString(),
                authors: ["N.I.T Egypt"],
                images: imgUrl ? [{ url: imgUrl, width: 1200, height: 630, alt: title }] : [],
                locale: isAr ? "ar_EG" : "en_US",
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: imgUrl ? [imgUrl] : [],
            },
        };
    } catch {
        return { title: "Article | N.I.T Egypt Blog" };
    }
}

// Layout renders nothing extra — the page itself handles Navbar + Footer
export default function ArticleLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
