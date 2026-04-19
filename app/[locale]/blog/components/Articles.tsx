/* eslint-disable @next/next/no-img-element */
'use client'
import { sliceText } from '@/utils/sliceText'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import LocaleLink from '../../components/LocaleLink'
import LoadingCard from '../../dashboard/components/LoadingCard'

const Articles = () => {
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(false)
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
                        articles.map((article: any, index: number) => (
                            <div
                                key={article.id}
                                className="col-span-12 md:col-span-6 lg:col-span-4 border bg-white overflow-hidden rounded-xl h-full relative group"
                            >
                                <LocaleLink href={`/blog/${article.id}`} className='block'>
                                    <div>
                                        <img
                                            src={article.img}
                                            alt={article.title}
                                            className='size-full '
                                        />
                                    </div>
                                    <div className='p-3 text-right'>
                                        <h2 className="text-lg font-bold">{article.title}</h2>
                                        <p className="text-sm text-gray-600">{sliceText(article.content, 130)}</p>
                                    </div>
                                </LocaleLink>
                            </div>
                        ))
                }
            </div >
        </div>
    )
}

export default Articles