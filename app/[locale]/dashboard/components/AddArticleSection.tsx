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
    list?: { [key: number]: { title?: { message?: string } } }
}

const AddArticleSection = ({ articleId }: { articleId: string }) => {
    const { editSection, setEditSection, updateSection, setSection }: any = useStore()
    const [loading, setLoading] = useState(false)
    const [listCount, setListCount] = useState(editSection?.list?.length || 0)
    const { register, formState: { errors }, handleSubmit, reset } = useForm()
    const router = useRouter()
    const pathname = usePathname()

    const close = () => {
        router.push(pathname)
        setEditSection(null)
        document.body.style.overflowY = 'auto'
    }
    const eleRef = useClickOutside(close)

    const buildPayload = (dataForm: any) => ({
        title: dataForm.title,
        titleEn: dataForm.titleEn || null,
        content: dataForm.description || null,
        contentEn: dataForm.descriptionEn || null,
        list: dataForm.list || [],
        articleId,
    })

    const onSubmit = async (dataForm: any) => {
        try {
            setLoading(true)
            const { data } = await axios.post(`/api/blog/section`, buildPayload(dataForm))
            setSection(data.section)
            toast.success(data.message)
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
            const { data } = await axios.put(`/api/blog/section/${editSection.id}`, buildPayload(dataForm))
            toast.success(data.message)
            updateSection(data.section)
            reset()
            setLoading(false)
            close()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    return (
        <div className='w-full h-full fixed bg-black/20 top-0 left-0 flex justify-center items-center px-5 z-50'>
            <div ref={eleRef} className='bg-white w-full sm:w-[480px] md:w-[560px] lg:w-[640px] rounded-lg max-h-[95svh] overflow-auto shadow-xl'>

                <div className='pt-5 px-6 flex justify-between items-center border-b pb-4'>
                    <div>
                        <h6 className='font-bold text-lg'>{editSection ? 'Edit Section' : 'Add Section'}</h6>
                        <p className='text-xs text-gray-400'>Each section becomes an &lt;h2&gt; heading. List items become &lt;h3&gt; headings.</p>
                    </div>
                    <button onClick={close}><CloseIcon className='size-5 text-gray-400' /></button>
                </div>

                <form onSubmit={handleSubmit(editSection ? handleUpdate : onSubmit)} className='px-6 py-5 space-y-5'>

                    {/* ── Section Titles ── */}
                    <div className='grid grid-cols-2 gap-3'>
                        <div>
                            <label className='block text-xs text-gray-400 mb-1 uppercase'>H2 Title — Arabic <span className='text-red-400'>*</span></label>
                            <input
                                {...register('title', { required: 'Arabic section title required', value: editSection?.title })}
                                placeholder='عنوان القسم بالعربية'
                                className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2 text-sm'
                                dir='rtl'
                            />
                            <ErrorMsg message={errors?.title?.message as string} />
                        </div>
                        <div>
                            <label className='block text-xs text-gray-400 mb-1 uppercase'>H2 Title — English</label>
                            <input
                                {...register('titleEn', { value: editSection?.titleEn })}
                                placeholder='Section title in English'
                                className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2 text-sm'
                            />
                        </div>
                    </div>

                    {/* ── Section Paragraphs ── */}
                    <div className='grid grid-cols-2 gap-3'>
                        <div>
                            <label className='block text-xs text-gray-400 mb-1 uppercase'>Paragraph — Arabic</label>
                            <textarea
                                {...register('description', { value: editSection?.content })}
                                placeholder='الفقرة التفصيلية بالعربية'
                                className='w-full h-24 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2 text-sm'
                                dir='rtl'
                            />
                        </div>
                        <div>
                            <label className='block text-xs text-gray-400 mb-1 uppercase'>Paragraph — English</label>
                            <textarea
                                {...register('descriptionEn', { value: editSection?.contentEn })}
                                placeholder='Section paragraph in English'
                                className='w-full h-24 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2 text-sm'
                            />
                        </div>
                    </div>

                    {/* ── List Items (H3 headings) ── */}
                    <div>
                        <div className='flex items-center justify-between mb-3'>
                            <div>
                                <span className='text-sm font-medium text-gray-700'>H3 List Items</span>
                                <span className='text-xs text-gray-400 ml-2'>(sub-points inside this section)</span>
                            </div>
                            <button
                                type='button'
                                onClick={() => setListCount((l: number) => l + 1)}
                                className='flex items-center gap-1 text-xs text-blue-600 border border-blue-300 rounded px-2.5 py-1 hover:bg-blue-50'
                            >
                                <PlusIcon className='size-3' /> Add Item
                            </button>
                        </div>

                        <div className='space-y-4'>
                            {Array(listCount).fill('').map((_, i) => (
                                <div key={i} className='border rounded-lg p-3 bg-gray-50 space-y-2'>
                                    <p className='text-xs font-semibold text-gray-500'>Item {i + 1}</p>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <div>
                                            <label className='text-xs text-gray-400'>H3 Title AR</label>
                                            <input
                                                {...register(`list[${i}].title`, {
                                                    required: 'Title required',
                                                    value: editSection?.list?.[i]?.title
                                                })}
                                                placeholder='العنوان الفرعي'
                                                className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm mt-0.5'
                                                dir='rtl'
                                            />
                                            <ErrorMsg message={(errors as ErrorsType).list?.[i]?.title?.message as string} />
                                        </div>
                                        <div>
                                            <label className='text-xs text-gray-400'>H3 Title EN</label>
                                            <input
                                                {...register(`list[${i}].titleEn`, {
                                                    value: editSection?.list?.[i]?.titleEn
                                                })}
                                                placeholder='Sub-item title EN'
                                                className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm mt-0.5'
                                            />
                                        </div>
                                    </div>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <textarea
                                            {...register(`list[${i}].content`, { value: editSection?.list?.[i]?.content })}
                                            placeholder='الوصف بالعربية'
                                            className='w-full h-16 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm'
                                            dir='rtl'
                                        />
                                        <textarea
                                            {...register(`list[${i}].contentEn`, { value: editSection?.list?.[i]?.contentEn })}
                                            placeholder='Description in English'
                                            className='w-full h-16 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm'
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button type='submit' className='bg-blue-500 hover:bg-blue-600 py-2.5 rounded-lg w-full text-white flex justify-center font-medium transition-colors'>
                        {loading ? <LoadingIcon className='animate-spin size-5' /> : (editSection ? 'Update Section' : 'Add Section')}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default AddArticleSection
