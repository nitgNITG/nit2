/* eslint-disable @next/next/no-img-element */
'use client'
import { DeleteIcon, EditIcon } from '../../components/icons'
import { useStore } from '@/lib/zustand'
import { sliceText } from '@/utils/sliceText'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DailogDelete from './DailogDelete'
import toast from 'react-hot-toast'
import LocaleLink from '../../components/LocaleLink'
import { isScheduled, stripRichText } from '@/lib/blog'
import { useRouter } from '@/navigation'
import Pagination from './Pagination'

type Status = 'loading' | 'error' | 'ready'

const formatDate = (d: string) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

export const PAGE_SIZE = 12
const pageHref = (n: number) => (n <= 1 ? '/dashboard/blog' : `/dashboard/blog?page=${n}`)

const Articles = ({ page = 1 }: { page?: number }) => {
    const { articles, setArticles }: any = useStore()
    const router = useRouter()
    const [status, setStatus] = useState<Status>('loading')
    const [total, setTotal] = useState(0)
    const [pages, setPages] = useState(1)
    const [deleArtilce, setDeleArticle] = useState('')
    const [loading, setLoading] = useState(false);

    const fetchArticles = useCallback(
        async () => {
            setStatus('loading')
            try {
                const { data } = await axios.get(`/api/blog/article?page=${page}&pageSize=${PAGE_SIZE}`)
                setArticles(data.articles)
                setTotal(data.total ?? data.articles.length)
                setPages(data.pages ?? 1)
                setStatus('ready')
                return data
            } catch (error: any) {
                console.error(error);
                setStatus('error')
            }
        }, [setArticles, page]
    )
    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    const colseDele = () => {
        setDeleArticle('')
        document.body.style.overflowY = 'auto'
    }
    const handleDelete = async () => {
        try {
            setLoading(true)
            const { data } = await axios.delete(`/api/blog/article/${deleArtilce}`)
            toast.success(data.message as string)
            colseDele()
            setLoading(false)
            // Refill the page from the next one; if it was the last item on the last page, step back.
            const fresh = await fetchArticles()
            if (fresh && !fresh.articles.length && page > 1) router.replace(pageHref(page - 1))
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
            console.error(error);
        }
    }

    if (status === 'loading')
        return (
            <div role='status' aria-live='polite' className='grid grid-cols-12 gap-5 lg:gap-10'>
                <span className='sr-only'>Loading articles…</span>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} aria-hidden className='col-span-12 md:col-span-6 lg:col-span-4 border bg-white rounded-xl overflow-hidden animate-pulse'>
                        <div className='h-40 bg-gray-200' />
                        <div className='p-3 space-y-2'>
                            <div className='h-4 bg-gray-200 rounded w-3/4' />
                            <div className='h-3 bg-gray-100 rounded' />
                            <div className='h-3 bg-gray-100 rounded w-5/6' />
                        </div>
                    </div>
                ))}
            </div>
        )

    if (status === 'error')
        return (
            <div role='alert' className='text-center space-y-3 py-10'>
                <p className='text-gray-600'>Couldn&apos;t load the articles.</p>
                <button onClick={fetchArticles} className='border border-blue-500 text-blue-600 px-4 py-1.5 rounded-md hover:bg-blue-50'>
                    Try again
                </button>
            </div>
        )

    if (!articles.length && total > 0)
        return (
            <div className='text-center py-10 space-y-3'>
                <p className='text-gray-600'>There&apos;s no page {page} — the blog has {pages} {pages === 1 ? 'page' : 'pages'}.</p>
                <LocaleLink href={pageHref(1)} className='text-blue-600 hover:underline'>Go to the first page</LocaleLink>
            </div>
        )

    if (!articles.length)
        return (
            <div className='text-center text-xl py-10'>
                <p>No articles found</p>
            </div>
        )

    const first = (page - 1) * PAGE_SIZE + 1
    return (
        <div className='space-y-8'>
            <div className='grid grid-cols-12 gap-5 lg:gap-10'>
                {articles.map((article: any) => {
                    const scheduled = isScheduled(article.publishedAt)
                    return (
                        <article
                            key={article.id}
                            className="col-span-12 md:col-span-6 lg:col-span-4 border bg-white overflow-hidden rounded-xl flex flex-col"
                        >
                            <LocaleLink href={`/dashboard/blog/article/${article.id}`} className='block relative'>
                                <img src={article.img} alt={article.title} className='w-full h-40 object-cover bg-gray-100' />
                                <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${scheduled ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                    {scheduled ? 'Scheduled' : 'Published'}
                                </span>
                            </LocaleLink>
                            <div className='p-3 flex-1 flex flex-col gap-2' dir='rtl'>
                                <h2 className="text-lg font-bold leading-snug">{article.title}</h2>
                                <p className="text-sm text-gray-600">{sliceText(stripRichText(article.content), 130)}</p>
                            </div>
                            <div className='px-3 py-2 border-t flex items-center justify-between gap-2 text-sm'>
                                <span className='text-xs text-gray-500'>
                                    {article.publishedAt ? `${scheduled ? 'Publishes' : 'Published'} ${formatDate(article.publishedAt)}` : ''}
                                </span>
                                <div className='flex items-center gap-1'>
                                    <LocaleLink
                                        href={`/dashboard/blog/article/${article.id}`}
                                        className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50'>
                                        <EditIcon className='size-4 stroke-current' /> Edit
                                    </LocaleLink>
                                    <button
                                        onClick={() => setDeleArticle(article.id)}
                                        aria-label={`Delete ${article.title}`}
                                        className='inline-flex items-center px-2 py-1 rounded-md text-red-600 hover:bg-red-50'>
                                        <DeleteIcon className='size-4 stroke-current' />
                                    </button>
                                </div>
                            </div>
                        </article>
                    )
                })}
                {deleArtilce &&
                    <DailogDelete
                        title='Delete article'
                        message='Are you sure to delete this article? Its sections are deleted with it.'
                        close={colseDele}
                        handleDelete={handleDelete}
                        loading={loading}
                    />}
            </div>
            <div className='flex flex-col items-center gap-3'>
                <p className='text-sm text-gray-500'>Showing {first}–{first + articles.length - 1} of {total}</p>
                <Pagination page={page} pages={pages} hrefFor={pageHref} label='Articles pages' />
            </div>
        </div>
    )
}

export default Articles
