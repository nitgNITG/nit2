/* eslint-disable @next/next/no-img-element */
import { getLocale, getTranslations } from 'next-intl/server'
import prisma from '@/prisma/client'
import Link from 'next/link'

// Fetch the 3 most recent articles at build/request time (Server Component)
async function getLatestArticles() {
    try {
        return await prisma.article.findMany({
            take: 3,
            orderBy: { publishedAt: 'desc' },
            select: {
                id: true,
                slug: true,
                title: true,
                titleEn: true,
                content: true,
                contentEn: true,
                img: true,
                publishedAt: true,
            },
        })
    } catch {
        return []
    }
}

export default async function HomepageBlog() {
    const [articles, locale, t] = await Promise.all([
        getLatestArticles(),
        getLocale(),
        getTranslations('blog'),
    ])

    // Don't render section if there are no articles yet
    if (articles.length === 0) return null

    const isAr = locale === 'ar'

    return (
        <section className='p-container py-14 lg:py-20'>
            {/* ── Section header ── */}
            <div className={`mb-10 ${isAr ? 'text-right' : 'text-left'}`}>
                <span className='inline-block bg-[#268F79]/10 border border-[#268F79]/30 text-[#268F79] text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider uppercase'>
                    {t('homeTeaserBadge')}
                </span>
                <h2 className='text-2xl md:text-3xl font-bold text-[#0B2923] mb-2'>
                    {t('homeTeaserTitle')}
                </h2>
                <p className='text-gray-500 text-base max-w-xl'>
                    {t('homeTeaserSub')}
                </p>
            </div>

            {/* ── Article cards ── */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {articles.map((article) => {
                    const title = isAr ? article.title : (article.titleEn || article.title)
                    const excerpt = isAr ? article.content : (article.contentEn || article.content)
                    const href = `/${locale}/blog/${article.slug || article.id}`
                    const date = article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString(
                            isAr ? 'ar-EG' : 'en-US',
                            { year: 'numeric', month: 'short', day: 'numeric' }
                        )
                        : null

                    return (
                        <Link
                            key={article.id}
                            href={href}
                            className='group bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow block'
                        >
                            {/* Thumbnail */}
                            <div className='overflow-hidden h-44'>
                                <img
                                    src={article.img}
                                    alt={title}
                                    className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                />
                            </div>

                            <div className={`p-5 flex flex-col gap-2 ${isAr ? 'text-right' : 'text-left'}`}>
                                {date && (
                                    <time className='text-xs text-[#268F79] font-semibold'>
                                        {date}
                                    </time>
                                )}
                                <h3 className='text-base font-bold text-gray-900 line-clamp-2 leading-snug'>
                                    {title}
                                </h3>
                                <p className='text-sm text-gray-500 line-clamp-2 leading-relaxed'>
                                    {excerpt}
                                </p>
                                <span className='text-sm font-semibold text-[#268F79] mt-1'>
                                    {isAr ? 'اقرأ المزيد ←' : 'Read more →'}
                                </span>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* ── View all link ── */}
            <div className={`mt-8 ${isAr ? 'text-right' : 'text-left'}`}>
                <Link
                    href={`/${locale}/blog`}
                    className='inline-block border-2 border-[#268F79] text-[#268F79] font-bold px-6 py-2.5 rounded-lg hover:bg-[#268F79] hover:text-white transition-colors text-sm'
                >
                    {t('viewAll')} →
                </Link>
            </div>
        </section>
    )
}
