/* eslint-disable @next/next/no-img-element */
'use client'
import { useCallback, useEffect, useState } from "react"
import axios from "axios"

const Page = ({ params }: { params: { articleId: string } }) => {
    const [article, setArticle] = useState(null as any)
    const { articleId } = params
    const [loading, setLoading] = useState(false)
    const fetchArticle = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/blog/article/${articleId}`)
                setArticle(data.article)
                setLoading(true)
            } catch (error) {
                setLoading(true)
                console.error(error);
            }
        }, [articleId]
    )
    useEffect(() => {
        fetchArticle()
    }, [fetchArticle])
    return (
        !loading ?
            <div className="py-10 lg:py-16 p-container">
                <div className="flex justify-center">
                    <div className="w-full h-72 lg:h-96 lg:w-[600px]  bg-slate-100 animate-pulse" />
                </div>
                <div className="flex flex-col items-center pt-5 lg:pt-10 space-y-2 ">
                    {
                        Array(10).fill("").map((_, i) => {
                            return (
                                <>
                                    <h1 className="w-10/12 h-4 bg-slate-100 animate-pulse rounded-md"></h1>
                                    <p className="w-10/12 h-2 bg-slate-100 animate-pulse rounded-md"></p>
                                </>
                            )
                        })
                    }
                </div>
            </div>
            :
            <div className="py-10 lg:py-16 p-container">
                <div className="flex justify-center">
                    <div className="w-full lg:w-[600px]">
                        <img
                            src={article?.img}
                            alt=""
                            className="size-full object-contain"
                        />
                    </div>
                </div>
                <div className="space-y-5 lg:space-y-10">
                    <div className="pt-5 lg:pt-10 space-y-2 md:space-y-5">
                        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">{article?.title}</h1>
                        <p className="md:text-lg lg:text-xl">{article?.content}</p>
                    </div>
                    <div className="space-y-5">
                        {
                            article?.Section?.map(
                                (item: { title: string, content: string, list: [{ title: string, content: string }] }, index: number) => (
                                    <div key={index} className="space-y-4">
                                        <div className="space-y-2">
                                            <h2 className="text-lg md:text-xl lg:text-2xl font-bold">{item.title}</h2>
                                            <p className="lg:text-lg lg:font-semibold">{item.content}</p>
                                        </div>
                                        <ul className="space-y-3">
                                            {
                                                item.list.map((li, i: number) => {
                                                    return (
                                                        <li key={i} className="space-y-2">
                                                            <h2 className="md:text-lg lg:text-xl font-bold flex justify-end">
                                                                <span>{li.title}</span>
                                                                <span>{`.${i + 1} `} </span>
                                                            </h2>
                                                            <p className="text-sm lg:text-lg lg:font-semibold">{li.content}</p>
                                                        </li>
                                                    )
                                                })
                                            }
                                        </ul>
                                    </div>
                                )
                            )
                        }
                    </div>
                </div>
            </div>
    )
}

export default Page