/* eslint-disable @next/next/no-img-element */
'use client'
import { sliceText } from '@/utils/sliceText'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
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
                console.error(error);
            }
        }, [setArticles]
    )
    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    return (
        <div className='p-container py-10 lg:py-16'>
            <div className='grid grid-cols-12 space-y-5 md:space-y-0 md:gap-5 lg:gap-10'>
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
                            return (
                                <div
                                    key={article.id}
                                    className="col-span-12 md:col-span-6 lg:col-span-4 border bg-white overflow-hidden rounded-xl h-full relative group"
                                >
                                    <LocaleLink href={`/blog/${article.id}`} className='block'>
                                        <div className='overflow-hidden'>
                                            <img
                                                src={article.img}
                                                alt={title}
                                                className='w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300'
                                            />
                                        </div>
                                        <div className={`p-4 ${isAr ? 'text-right' : 'text-left'}`}>
                                            <h2 className="text-base font-bold mb-2 leading-snug line-clamp-2">{title}</h2>
                                            <p className="text-sm text-gray-500 line-clamp-3">{sliceText(content, 130)}</p>
                                        </div>
                                    </LocaleLink>
                                </div>
                            )
                        })
                }
            </div >
        </div>
    )
}

export default Articles