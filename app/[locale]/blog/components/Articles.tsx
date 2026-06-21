'use client'
import { sliceText } from '@/utils/sliceText'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import LocaleLink from '../../components/LocaleLink'
import LoadingCard from '../../dashboard/components/LoadingCard'
import { useLocale } from 'next-intl'

const Articles = () => {
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(false)
    const locale = useLocale()
    const isAr = locale === 'ar'

    const fetchArticles = useCallback(
        async () => {
            try {
                const { data } = await axios.get('/api/blog/article')
                setArticles(data.articles)
                setLoading(true)
            } catch (error: any) {
                setLoading(true)
                // console.error(error)
            }
        }, [setArticles]
    )
    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    return (
        <div className='p-container py-10 lg:py-16'>
            <div className='grid grid-cols-12 gap-6'>
                {
                    !loading ?
                        <LoadingCard number={6} />
                        :
                        articles.length === 0 ? (
                            <div className="col-span-12 text-center text-gray-400 py-16 text-lg">
                                {isAr ? 'لا توجد مقالات حتى الآن' : 'No articles yet'}
                            </div>
                        ) :
                        articles.map((article: any) => {
                            const title = isAr ? article.title : (article.titleEn || article.title)
                            const content = isAr ? article.content : (article.contentEn || article.content)
                            // Use slug for SEO-friendly URL, fall back to id for old articles
                            const href = `/blog/${article.slug || article.id}`
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
                                    <LocaleLink href={href} className='block h-full'>
                                        {/* Thumbnail */}
                                        <div className='relative overflow-hidden h-48'>
                                            <Image
                                                src={article.img}
                                                alt={title}
                                                fill
                                                sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                                                className='object-cover group-hover:scale-105 transition-transform duration-300'
                                            />
                                        </div>

                                        <div className={`p-5 flex flex-col gap-3 ${isAr ? 'text-right' : 'text-left'}`}>
                                            {/* Date */}
                                            {date && (
                                                <time className="text-xs text-[#1E7D67] font-semibold tracking-wide">
                                                    {date}
                                                </time>
                                            )}

                                            {/* Title */}
                                            <h2 className="text-base font-bold leading-snug line-clamp-2 text-gray-900">
                                                {title}
                                            </h2>

                                            {/* Excerpt */}
                                            <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">
                                                {sliceText(content, 130)}
                                            </p>

                                            {/* Read more */}
                                            <span className="text-sm font-semibold text-[#1E7D67] mt-auto">
                                                {isAr ? 'اقرأ المزيد ←' : 'Read more →'}
                                            </span>
                                        </div>
                                    </LocaleLink>
                                </div>
                            )
                        })
                }
            </div>
        </div>
    )
}

export default Articles
