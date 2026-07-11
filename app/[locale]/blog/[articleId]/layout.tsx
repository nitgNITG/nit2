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

// Fetch article for JSON-LD (same helper used by generateMetadata above)
async function getArticleForJsonLd(articleId: string, locale: string) {
    try {
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
        return article;
    } catch {
        return null;
    }
}

export default async function ArticleLayout({
    children,
    params: { articleId, locale },
}: {
    children: React.ReactNode;
    params: { articleId: string; locale: string };
}) {
    const article = await getArticleForJsonLd(articleId, locale);
    const isAr = locale === 'ar';

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: isAr ? 'الرئيسية' : 'Home', item: `https://www.nitg-eg.com/${locale}` },
            { '@type': 'ListItem', position: 2, name: isAr ? 'المدونة' : 'Blog', item: `https://www.nitg-eg.com/${locale}/blog` },
            ...(article ? [{
                '@type': 'ListItem',
                position: 3,
                name: isAr ? article.title : (article.titleEn ?? article.title),
                item: `https://www.nitg-eg.com/${locale}/blog/${article.slug ?? articleId}`,
            }] : []),
        ],
    };

    const articleJsonLd = article ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: isAr ? article.title : (article.titleEn ?? article.title),
        description: isAr ? (article.metaDesc ?? '') : (article.metaDescEn ?? article.metaDesc ?? ''),
        image: article.img,
        datePublished: article.publishedAt?.toISOString(),
        dateModified: article.publishedAt?.toISOString(),
        inLanguage: isAr ? 'ar-EG' : 'en-US',
        author: { '@type': 'Organization', name: 'N.I.T Egypt', url: 'https://www.nitg-eg.com' },
        publisher: {
            '@type': 'Organization',
            name: 'N.I.T Egypt',
            logo: { '@type': 'ImageObject', url: 'https://www.nitg-eg.com/footer_logo.png' },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://www.nitg-eg.com/${locale}/blog/${article.slug ?? articleId}`,
        },
    } : null;

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
            {articleJsonLd && (
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
            )}
            {children}
        </>
    );
}
