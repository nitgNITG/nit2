/* eslint-disable @next/next/no-img-element */
'use client';
import ErrorMsg from "@/app/[locale]/components/ErrorMsg";
import { ImageIcon, LoadingIcon } from "@/app/[locale]/components/icons";
import { useStore } from "@/lib/zustand";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

const Blog = () => {
    const { setArticle }: any = useStore();
    const { register, formState: { errors }, handleSubmit, reset } = useForm();
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const btnRef = useRef<any>(null);
    useEffect(() => {
        const input = document.getElementById('input-project-img');
        const btn = btnRef.current;
        const handleClickInput = (e: any) => {
            e.preventDefault()
            input?.click()
        }
        btn?.addEventListener('click', handleClickInput)
        return () => {
            btn?.removeEventListener('click', handleClickInput)
        }
    }, [])
    const onSubmit = async (dataForm: any) => {
        try {
            setLoading(true)
            const formData = new FormData();
            formData.append('img', dataForm.file[0]);
            formData.append('title', dataForm.title);
            formData.append('content', dataForm.content);
            const { data } = await axios.post(`/api/blog/article`, formData);
            toast.success(data.message as string)
            setArticle(data.article)
            URL.revokeObjectURL(image)
            setImage("")
            reset()
            setLoading(false)
            router.push(`/dashboard/blog/article/${data.article.id}`)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }
    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Add article</h4>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    {!image ?
                        <button
                            ref={btnRef}
                            className='w-full h-72 bg-gray-200 rounded-md flex justify-center items-center' >
                            <ImageIcon className='size-8 stroke-gray-500' />
                        </button> :
                        <img
                            src={image}
                            className='w-full h-72 rounded-md object-contain'
                            alt=''
                            height={400}
                            width={400}
                        />
                    }
                    <input
                        id='input-project-img'
                        {...register('file', {
                            required: "Please Enter Image..",
                            onChange: (event) => {
                                setImage(URL.createObjectURL(event.target.files[0]))
                            },
                        })}
                        type="file"
                        className='hidden'
                    />
                    <ErrorMsg message={errors?.file?.message as string} />
                </div>
                <div>
                    <input
                        {...register('title', {
                            required: "Please Enter Title..",
                        })}
                        placeholder='Title'
                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                        type="text"
                    />
                    <ErrorMsg message={errors?.title?.message as string} />
                </div>
                <div>
                    <textarea
                        {...register('content', {
                            required: "Please Enter content..",
                        })}
                        placeholder='Content'
                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2 resize-none h-32'
                    />
                    <ErrorMsg message={errors?.content?.message as string} />
                </div>
                <button className='bg-blue-500 py-2 rounded-md w-full text-white flex justify-center'>
                    {loading ? <LoadingIcon className='animate-spin size-5' /> : "Next"}
                </button>
            </form>
        </div>
    )
}

export default Blog