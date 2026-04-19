/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, ImageIcon, LoadingIcon } from '../../components/icons'
import ErrorMsg from '../../components/ErrorMsg'

const EditArticle = ({ article, close }: { article: any, close: () => void }) => {
    const { updateArticle }: any = useStore();
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const { register, formState: { errors }, handleSubmit, reset } = useForm();
    const btnRef = useRef<any>(null);
    const eleRef = useClickOutside(close)

    const handleupdate = async (dataForm: any) => {
        try {
            setLoading(true)
            const formData = new FormData();
            formData.append('oldImg', article?.img as string)
            formData.append('img', dataForm.file[0]);
            formData.append('title', dataForm.title);
            formData.append('content', dataForm.content);

            const { data } = await axios.put(`/api/blog/article/${article.id}`, formData);
            updateArticle(data.article)
            toast.success(data.message as string)
            reset()
            setLoading(false)
            close()
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    useEffect(() => {
        const input = document.getElementById('input-project-img');
        const btn = btnRef.current;
        const handleClickInput = (e: any) => {
            e.preventDefault();
            input?.click()
        }
        btn?.addEventListener('click', handleClickInput)
        return () => {
            btn?.removeEventListener('click', handleClickInput)
        }
    }, [])


    return (
        <div>
            <div className='w-full h-full fixed bg-black/20 top-0 left-0 flex justify-center items-center px-5 z-50'>
                <div ref={eleRef} className='bg-white w-full sm:w-[420px] md:w-[500px] lg:w-[550px] rounded-md max-h-[95svh] overflow-auto'>
                    <div className='space-y-2'>
                        <div className='pt-5 px-5 flex justify-between items-center'>
                            <h6 className='font-bold '>Edit Article</h6>
                            <button onClick={close}><CloseIcon className='size-6' /></button>
                        </div>
                        <form onSubmit={handleSubmit(handleupdate)} className='px-5 pb-5 space-y-3'>
                            <div>
                                <div className=''>
                                    <>
                                        {
                                            article?.img ?
                                                <div className='relative flex justify-center items-center group'>
                                                    <img
                                                        src={image ? image : article.img}
                                                        className='w-full h-72 rounded-md object-cover'
                                                        alt=''
                                                        height={400}
                                                        width={400}
                                                    />
                                                    <button
                                                        ref={btnRef}
                                                        className='absolute  hidden group-hover:block' >
                                                        <ImageIcon className='size-8 stroke-gray-500 fill-gray-50' />
                                                    </button>
                                                    <input
                                                        id='input-project-img'
                                                        {...register('file', {
                                                            onChange: (event) => {
                                                                setImage(URL.createObjectURL(event.target.files[0]))
                                                            },
                                                        })}
                                                        type="file"
                                                        className='hidden'
                                                    />
                                                </div>
                                                :
                                                <>
                                                    {!image ?
                                                        <button
                                                            ref={btnRef}
                                                            className='w-full h-72 bg-gray-200 rounded-md flex justify-center items-center' >
                                                            <ImageIcon className='size-8 stroke-gray-500' />
                                                        </button> :
                                                        <img
                                                            src={image}
                                                            className='w-full h-72 rounded-md object-cover'
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
                                                </>
                                        }
                                    </>
                                </div>
                                <ErrorMsg message={errors?.file?.message as string} />
                            </div>
                            <div>
                                <input
                                    {...register('title', {
                                        required: "Please Enter Title..",
                                        value: article?.title || "",
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
                                        value: article.content
                                    })}
                                    placeholder='Content'
                                    className='w-full h-32 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                />
                                <ErrorMsg message={errors?.content?.message as string} />
                            </div>
                            <button className='bg-blue-500 py-2 rounded-md w-full text-white flex justify-center'>
                                {loading ? <LoadingIcon className='animate-spin size-5' /> : "Edit"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EditArticle