import type { Metadata } from "next";
import BlogHeader from "../components/BlogHeader";
import Footer from "../../components/Footer";
import prisma from "@/prisma/client";

export async function generateMetadata({
    params: { articleId, locale },
}: {
    params: { articleId: string; locale: string };
}): Promise<Metadata> {
    try {
        const article = await prisma.article.findUnique({
            where: { id: articleId },
            select: { title: true, titleEn: true, metaDesc: true, metaDescEn: true, img: true },
        });

        if (!article) {
            return { title: "Article | N.I.T Egypt Blog" };
        }

        const isAr = locale === "ar";
        const title = isAr ? article.title : (article.titleEn ?? article.title);
        const description = isAr
            ? (article.metaDesc ?? "")
            : (article.metaDescEn ?? article.metaDesc ?? "");

        return {
            title,
            description,
            alternates: {
                canonical: `https://nitg-eg.com/${locale}/blog/${articleId}`,
                languages: {
                    ar: `https://nitg-eg.com/ar/blog/${articleId}`,
                    en: `https://nitg-eg.com/en/blog/${articleId}`,
                },
            },
            openGraph: {
                title,
                description,
                url: `https://nitg-eg.com/${locale}/blog/${articleId}`,
                type: "article",
                images: article.img ? [{ url: article.img.startsWith("/") ? `https://nitg-eg.com${article.img}` : article.img }] : [],
                locale: isAr ? "ar_EG" : "en_US",
            },
            twitter: {
                card: "summary_large_image",
                title,
                description,
                images: article.img ? [article.img.startsWith("/") ? `https://nitg-eg.com${article.img}` : article.img] : [],
            },
        };
    } catch {
        return { title: "Article | N.I.T Egypt Blog" };
    }
}

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <BlogHeader />
            {children}
            <Footer />
        </div>
    );
}
