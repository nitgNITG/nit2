/* eslint-disable @next/next/no-img-element */
'use client'
import { DeleteIcon, EditIcon, PlusIcon } from '../../components/icons'
import { useStore } from '@/lib/zustand'
import { sliceText } from '@/utils/sliceText'
import axios from 'axios'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import DailogDelete from './DailogDelete'
import toast from 'react-hot-toast'
import Addarticle from './EditArticle'
import LocaleLink from '../../components/LocaleLink'

const Articles = () => {
    const { articles, setArticles, deleteArticle }: any = useStore()
    const [eidtArticle, setEidtArticle] = useState(null as any)
    const [deleArtilce, setDeleArticle] = useState('')
    const [loading, setLoading] = useState(false);

    const fetchArticles = useCallback(
        async () => {
            try {
                const { data } = await axios.get('/api/blog/article')
                setArticles(data.articles)
            } catch (error: any) {
                console.error(error);
            }
        }, [setArticles]
    )
    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    const colseDele = () => {
        setDeleArticle('')
        document.body.style.overflowY = 'auto'
    }
    const closeEidt = () => {
        setEidtArticle(null as any)
        document.body.style.overflowY = 'auto'
    }
    const handleDelete = async () => {
        try {
            setLoading(true)
            const { data } = await axios.delete(`/api/blog/article/${deleArtilce}`)
            toast.success(data.message as string)
            deleteArticle(deleArtilce)
            colseDele()
            setLoading(false)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
            console.error(error);
        }
    }

    return (
        articles.length ?
            <div className='grid grid-cols-12 space-y-5 md:space-y-0 md:gap-5 lg:gap-10'>
                {articles.map((article: any, index: number) => (
                    <div
                        key={article.id}
                        className="col-span-12 md:col-span-6 lg:col-span-4 border bg-white overflow-hidden rounded-xl h-full relative group"
                    >
                        <div className='absolute top-0 right-2 bg-black/50 pt-2 px-1 pb-3 rounded-b-md -translate-y-32 group-hover:translate-y-0 duration-200'>
                            <div className='space-y-3'>
                                <LocaleLink
                                    href={`/dashboard/blog/article/${article.id}`}
                                    className='block'>
                                    <PlusIcon className='size-7 stroke-white' />
                                </LocaleLink>
                                <button
                                    onClick={() => {
                                        setEidtArticle(article)
                                    }}
                                    className='block'>
                                    <EditIcon className='size-7 stroke-white' />
                                </button>
                                <button
                                    onClick={() => {
                                        setDeleArticle(article.id)
                                    }}
                                    className='block'>
                                    <DeleteIcon className='size-7 stroke-white' />
                                </button>
                            </div>
                        </div>
                        <Link href={''} className='block'>
                            <div>
                                <img
                                    src={article.img}
                                    alt={article.title}
                                    className='size-full '
                                />
                            </div>
                            <div className='p-3'>
                                <h2 className="text-lg font-bold">{article.title}</h2>
                                <p className="text-sm text-gray-600">{sliceText(article.content, 130)}</p>
                            </div>
                        </Link>
                    </div>
                ))}
                {deleArtilce &&
                    <DailogDelete
                        title='Delete sponser'
                        message='Are you sure to delete this article?'
                        close={colseDele}
                        handleDelete={handleDelete}
                        loading={loading}
                    />}
                {eidtArticle &&
                    <Addarticle
                        close={closeEidt}
                        article={eidtArticle}
                    />}
            </div>
            :
            <div className='text-center text-xl'>
                <p>No articles found</p>
            </div>
    )
}

export default Articles