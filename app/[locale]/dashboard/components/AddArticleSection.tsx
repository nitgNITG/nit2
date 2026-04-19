/* eslint-disable @next/next/no-img-element */
'use client'

import { useStore } from '@/lib/zustand'
import axios from 'axios'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, LoadingIcon, PlusIcon } from '../../components/icons'
import ErrorMsg from '../../components/ErrorMsg'
type ErrorsType = {
    list?: {
        [key: number]: {
            title?: {
                message?: string;
            };
        };
    };
};
const AddArticleSection = ({ articleId }: { articleId: string }) => {
    const { editSection, setEditSection, updateSection, setSection }: any = useStore();
    const [loading, setLoading] = useState(false)
    const [list, setList] = useState(editSection?.list?.length || 0)
    const { register, formState: { errors }, handleSubmit, reset } = useForm();
    const btnRef = useRef<any>(null);
    const router = useRouter();
    const pathname = usePathname()
    const close = () => {
        router.push(pathname)
        setEditSection(null)
        document.body.style.overflowY = "auto"
    }
    const eleRef = useClickOutside(close)
    const onSubmit = async (dataForm: any) => {
        try {
            setLoading(true)
            const { data } = await axios.post(`/api/blog/section`, {
                title: dataForm.title,
                content: dataForm.description,
                list: dataForm.list,
                articleId
            });
            setSection(data.section)
            toast.success(data.message as string)
            reset()
            setLoading(false)
            close()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }
    const handleUpdate = async (dataForm: any) => {
        try {
            setLoading(true)
            const { data } = await axios.put(`/api/blog/section/${editSection.id}`, {
                title: dataForm.title,
                content: dataForm.description,
                list: dataForm.list,
                articleId
            });
            toast.success(data.message as string)
            updateSection(data.section)
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
            e.preventDefault()
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
                            <h6 className='font-bold '>{editSection ? 'Edit Section' : "Add Section"}</h6>
                            <button onClick={close}><CloseIcon className='size-6' /></button>
                        </div>
                        <form onSubmit={handleSubmit(editSection ? handleUpdate : onSubmit)} className='px-5 pb-5 space-y-3'>

                            <div>
                                <input
                                    {...register('title', {
                                        required: "Please Enter Title..",
                                        value: editSection?.title
                                    })}
                                    placeholder='Title'
                                    className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                    type="text"
                                />
                                <ErrorMsg message={errors?.title?.message as string} />
                            </div>
                            <div>
                                <textarea
                                    {...register('description', {
                                        required: "Please Enter Description..",
                                        value: editSection?.content
                                    })}
                                    placeholder='Description'
                                    className='w-full h-32 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                />
                                <ErrorMsg message={errors?.description?.message as string} />
                            </div>
                            <div>
                                <div className='flex items-center justify-between'>
                                    <span className='uppercase'>
                                        Items :
                                    </span>
                                    <div
                                        className='cursor-pointer'
                                        onClick={() => setList((l: number) => l + 1)}
                                    >
                                        <PlusIcon className='size-6' />
                                    </div>
                                </div>
                                {
                                    Array(list).fill("").map((_, i) => {
                                        return (
                                            <div key={i} className='space-y-2'>
                                                <span className='font-medium'>Item {i + 1} :</span>
                                                <div className=''>
                                                    <input
                                                        {...register(`list[${i}].title`, {
                                                            required: 'Please Enter the title of list',
                                                            value: editSection?.list[i]?.title
                                                        })}
                                                        placeholder='title'
                                                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                                        type="text"
                                                    />
                                                    <ErrorMsg message={(errors as ErrorsType).list?.[i]?.title?.message as string as string} />
                                                </div>
                                                <div>
                                                    <textarea
                                                        {...register(`list[${i}].content`, {
                                                            value: editSection?.list[i]?.content
                                                        })}
                                                        placeholder='content'
                                                        className='w-full h-16 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                            <button className='bg-blue-500 py-2 rounded-md w-full text-white flex justify-center'>
                                {loading ? <LoadingIcon className='animate-spin size-5' /> : "Add"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AddArticleSection