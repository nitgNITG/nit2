import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import prisma from '@/prisma/client'
import Footer from '../../components/Footer'
import Navbar from '../../components/Navbar'

// ── Data fetcher (reused by both generateMetadata and the page) ──────────
async function getArticle(articleId: string) {
    return prisma.article.findFirst({
        where: { id: articleId },
        select: {
            id: true,
            title: true,
            titleEn: true,
            content: true,
            contentEn: true,
            metaDesc: true,
            metaDescEn: true,
            img: true,
            publishedAt: true,
            Section: {
                select: {
                    id: true,
                    title: true,
                    titleEn: true,
                    content: true,
                    contentEn: true,
                    list: true,
                }
            }
        }
    })
}

// ── Dynamic metadata (Google reads this) ─────────────────────────────────
export async function generateMetadata(
    { params }: { params: { articleId: string; locale: string } }
): Promise<Metadata> {
    const article = await getArticle(params.articleId)
    if (!article) return {}

    const isAr = params.locale === 'ar'
    const title = isAr ? article.title : (article.titleEn || article.title)
    const desc = isAr
        ? (article.metaDesc || article.content.slice(0, 155) + '…')
        : (article.metaDescEn || (article.contentEn || article.content).slice(0, 155) + '…')

    return {
        title,
        description: desc,
        alternates: {
            canonical: `https://nitg-eg.com/${params.locale}/blog/${params.articleId}`,
            languages: {
                ar: `https://nitg-eg.com/ar/blog/${params.articleId}`,
                en: `https://nitg-eg.com/en/blog/${params.articleId}`,
            },
        },
        openGraph: {
            title,
            description: desc,
            type: 'article',
            publishedTime: article.publishedAt?.toISOString(),
            authors: ['N.I.T Egypt'],
            images: [{ url: article.img, width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: desc,
            images: [article.img],
        },
    }
}

// ── Page ─────────────────────────────────────────────────────────────────
export default async function ArticlePage(
    { params }: { params: { articleId: string; locale: string } }
) {
    const article = await getArticle(params.articleId)
    if (!article) notFound()

    const isAr = params.locale === 'ar'
    const dir = isAr ? 'rtl' : 'ltr'

    const displayTitle = isAr ? article.title : (article.titleEn || article.title)
    const displayContent = isAr ? article.content : (article.contentEn || article.content)
    const metaDesc = isAr
        ? (article.metaDesc || article.content.slice(0, 155))
        : (article.metaDescEn || (article.contentEn || article.content).slice(0, 155))

    // Article JSON-LD — enables rich snippets in Google Search
    const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: displayTitle,
        description: metaDesc,
        image: article.img,
        datePublished: article.publishedAt?.toISOString(),
        dateModified: article.publishedAt?.toISOString(),
        inLanguage: isAr ? 'ar-EG' : 'en-US',
        author: {
            '@type': 'Organization',
            name: 'N.I.T Egypt',
            url: 'https://nitg-eg.com',
        },
        publisher: {
            '@type': 'Organization',
            name: 'N.I.T Egypt',
            logo: { '@type': 'ImageObject', url: 'https://nitg-eg.com/footer_logo.png' },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://nitg-eg.com/${params.locale}/blog/${params.articleId}`,
        },
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
            />

            <Navbar />

            {/*
              ── SEO HEADER HIERARCHY ──────────────────────────────────────────
              H1  → article title           (one per page, the main topic)
              H2  → each section title      (major subtopics)
              H3  → each list item title    (supporting points inside a section)
              ─────────────────────────────────────────────────────────────────
            */}
            <article dir={dir} className="py-10 lg:py-16 p-container max-w-3xl mx-auto">

                {/* ── Hero image ── */}
                <div className="mb-8 rounded-xl overflow-hidden">
                    <Image
                        src={article.img}
                        alt={displayTitle}
                        priority
                        quality={90}
                        sizes="(max-width: 768px) 100vw, 800px"
                        width={800}
                        height={500}
                        className="w-full object-cover"
                    />
                </div>

                {/* ── H1: article title ── */}
                <h1 className={`text-2xl md:text-3xl lg:text-4xl font-bold leading-snug mb-4 ${isAr ? 'text-right' : 'text-left'}`}>
                    {displayTitle}
                </h1>

                {/* ── Publish date (shown + in schema) ── */}
                <time
                    dateTime={article.publishedAt?.toISOString()}
                    className="block text-sm text-gray-400 mb-6"
                >
                    {article.publishedAt?.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    })}
                </time>

                {/* ── Intro paragraph ── */}
                <p className={`text-base lg:text-lg text-gray-700 leading-relaxed mb-10 ${isAr ? 'text-right' : 'text-left'}`}>
                    {displayContent}
                </p>

                {/* ── Sections ── */}
                <div className="space-y-10">
                    {article.Section.map((section) => {
                        const sectionTitle = isAr ? section.title : (section.titleEn || section.title)
                        const sectionContent = isAr ? section.content : (section.contentEn || section.content)
                        return (
                            <section key={section.id}>
                                {/* ── H2: section title (major subtopic) ── */}
                                <h2 className={`text-xl md:text-2xl font-bold mb-3 text-gray-900 ${isAr ? 'text-right' : 'text-left'}`}>
                                    {sectionTitle}
                                </h2>

                                {sectionContent && (
                                    <p className={`text-base lg:text-lg text-gray-700 leading-relaxed mb-5 ${isAr ? 'text-right' : 'text-left'}`}>
                                        {sectionContent}
                                    </p>
                                )}

                                {section.list.length > 0 && (
                                    <ul className="space-y-5 mt-4">
                                        {section.list.map((item, i) => {
                                            const itemTitle = isAr ? item.title : (item.titleEn || item.title)
                                            const itemContent = isAr ? item.content : (item.contentEn || item.content)
                                            return (
                                                <li key={i} className={`border-r-4 border-[#268F79] pr-4 ${isAr ? 'text-right' : 'border-r-0 border-l-4 pl-4 text-left'}`}>
                                                    {/* ── H3: list item title (supporting point) ── */}
                                                    <h3 className="text-lg font-bold text-gray-800 mb-1">
                                                        {itemTitle}
                                                    </h3>
                                                    {itemContent && (
                                                        <p className="text-gray-600 text-base leading-relaxed">{itemContent}</p>
                                                    )}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </section>
                        )
                    })}
                </div>

                {/* ── CTA at end of article ── */}
                <div className="mt-14 p-6 bg-gradient-to-r from-[#0B2923] to-[#268F79] rounded-xl text-center">
                    <p className="text-white font-bold text-lg mb-3">
                        {isAr ? 'هل تحتاج مشروعًا مثل هذا؟' : 'Ready to build your project?'}
                    </p>
                    <a
                        href={`/${params.locale}/contact`}
                        className="inline-block bg-[#00FFB2] text-[#0B2923] font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                    >
                        {isAr ? 'تواصل معنا الآن' : 'Contact us now'}
                    </a>
                </div>
            </article>

            <Footer />
        </>
    )
}
