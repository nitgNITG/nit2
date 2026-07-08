import { sliceText } from '@/utils/sliceText'
import Image from 'next/image'
import Link from 'next/link'
import prisma from '@/prisma/client'
import { getLocale } from 'next-intl/server'

async function getArticles() {
    try {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB timeout')), 5000)
        )
        return await Promise.race([
            prisma.article.findMany({
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
            }),
            timeout,
        ]) as Awaited<ReturnType<typeof prisma.article.findMany>>
    } catch {
        return []
    }
}

export default async function Articles() {
    const [articles, locale] = await Promise.all([getArticles(), getLocale()])
    const isAr = locale === 'ar'

    if (articles.length === 0) {
        return (
            <div className='p-container py-10 lg:py-16'>
                <div className="col-span-12 text-center text-gray-400 py-16 text-lg">
                    {isAr ? 'لا توجد مقالات حتى الآن' : 'No articles yet'}
                </div>
            </div>
        )
    }

    return (
        <div className='p-container py-10 lg:py-16'>
            <div className='grid grid-cols-12 gap-6'>
                {articles.map((article: any) => {
                    const title = isAr ? article.title : (article.titleEn || article.title)
                    const content = isAr ? article.content : (article.contentEn || article.content)
                    const href = `/${locale}/blog/${article.slug || article.id}`
                    const date = article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString(
                            isAr ? 'ar-EG' : 'en-US',
                            { year: 'numeric', month: 'long', day: 'numeric' }
                        )
                        : null

                    return (
                        <div
                            key={article.id}
                            className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-gray-100 overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
                        >
                            <Link href={href} className='block h-full'>
                                <div className='relative overflow-hidden h-48'>
                                    <Image
                                        src={article.img}
                                        alt={title}
                                        fill
                                        sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                                        className='object-cover group-hover:scale-105 transition-transform duration-300'
                                        unoptimized={article.img?.startsWith('/uploads/')}
                                    />
                                </div>
                                <div className={`p-5 flex flex-col gap-3 ${isAr ? 'text-right' : 'text-left'}`}>
                                    {date && (
                                        <time className="text-xs text-[#1E7D67] font-semibold tracking-wide">
                                            {date}
                                        </time>
                                    )}
                                    <h2 className="text-base font-bold leading-snug line-clamp-2 text-gray-900">
                                        {title}
                                    </h2>
                                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                                        {sliceText(content, 130)}
                                    </p>
                                    <span className="text-sm font-semibold text-[#1E7D67] mt-auto">
                                        {isAr ? 'اقرأ المزيد ←' : 'Read more →'}
                                    </span>
                                </div>
                            </Link>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
