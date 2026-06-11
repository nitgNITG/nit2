/* eslint-disable @next/next/no-img-element */
'use client'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, ImageIcon, LoadingIcon } from '../../components/icons'
import ErrorMsg from '../../components/ErrorMsg'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'

type ProjectType = { id: string; value: string; labelEn: string; labelAr: string }

const AddEditProject = ({ defaultType }: { defaultType?: string }) => {
    const { addProject, editProject, setEditProject, updateProject, addApp, updateApp }: any = useStore()
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])

    // Fetch types from DB
    useEffect(() => {
        axios.get('/api/project-type')
            .then(({ data }) => setProjectTypes(data.types))
            .catch(() => console.error('Failed to load project types'))
    }, [])

    const defaultTypes = editProject?.types?.length
        ? editProject.types
        : defaultType ? [defaultType] : []

    const { register, control, formState: { errors }, handleSubmit, reset, watch } = useForm({
        defaultValues: {
            title: editProject?.title || '',
            titleEn: editProject?.titleEn || '',
            description: editProject?.description || '',
            descriptionEn: editProject?.descriptionEn || '',
            types: defaultTypes as string[],
            important: editProject?.important || false,
            links: (editProject?.links?.length > 0)
                ? editProject.links
                : [{ headerEn: '', headerAr: '', link: '' }],
        }
    })

    const selectedTypes: string[] = watch('types') || []
    const { fields, append, remove } = useFieldArray({ control, name: 'links' })

    const btnRef = useRef<any>(null)
    const router = useRouter()
    const pathname = usePathname()

    const close = () => {
        router.push(pathname)
        setEditProject(null)
        document.body.style.overflowY = 'auto'
    }
    const eleRef = useClickOutside(close)

    const buildFormData = (dataForm: any, oldImg?: string) => {
        const formData = new FormData()
        if (oldImg) formData.append('oldImg', oldImg)
        if (dataForm.file?.[0]) formData.append('img', dataForm.file[0])
        formData.append('title', dataForm.title)
        formData.append('description', dataForm.description)
        formData.append('titleEn', dataForm.titleEn)
        formData.append('descriptionEn', dataForm.descriptionEn)
        formData.append('important', String(!!dataForm.important))
        const types = Array.isArray(dataForm.types) ? dataForm.types.filter(Boolean) : []
        formData.append('types', JSON.stringify(types))
        const cleanLinks = (dataForm.links || []).filter((l: any) => l.link?.trim())
        formData.append('links', JSON.stringify(cleanLinks))
        return formData
    }

    const onSubmit = async (dataForm: any) => {
        const types = Array.isArray(dataForm.types) ? dataForm.types.filter(Boolean) : []
        if (types.length === 0) { toast.error('Please select at least one project type'); return }
        try {
            setLoading(true)
            const formData = buildFormData(dataForm)
            const { data } = await axios.post(`/api/project`, formData)
            addProject(data.project)
            toast.success(data.message)
            reset()
            setLoading(false)
            close()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    const handleupdateProject = async (dataForm: any) => {
        try {
            setLoading(true)
            const formData = buildFormData(dataForm, editProject?.img)
            const { data } = await axios.put(`/api/project/${editProject.id}`, formData)
            toast.success(data.message)
            updateProject(data.project)
            reset()
            setLoading(false)
            close()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    useEffect(() => {
        const input = document.getElementById('input-project-img')
        const btn = btnRef.current
        const handleClickInput = (e: any) => { e.preventDefault(); input?.click() }
        btn?.addEventListener('click', handleClickInput)
        return () => btn?.removeEventListener('click', handleClickInput)
    }, [])

    return (
        <div className='w-full h-full fixed bg-black/20 top-0 left-0 flex justify-center items-center px-5 z-50'>
            <div ref={eleRef} className='bg-white w-full sm:w-[440px] md:w-[520px] lg:w-[600px] rounded-lg max-h-[95svh] overflow-auto shadow-xl'>
                <div className='pt-5 px-6 flex justify-between items-center border-b pb-4'>
                    <h6 className='font-bold text-lg'>{editProject ? 'Edit Project' : 'Add New Project'}</h6>
                    <button onClick={close}><CloseIcon className='size-5 text-gray-400' /></button>
                </div>

                <form onSubmit={handleSubmit(editProject ? handleupdateProject : onSubmit)} className='px-6 py-5 space-y-4'>

                    {/* ── Image ── */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>Project Image</label>
                        {editProject?.img ? (
                            <div className='relative flex justify-center items-center group rounded-md overflow-hidden h-48 bg-gray-100'>
                                <img src={image || editProject.img} className='w-full h-full object-cover' alt='' />
                                <button ref={btnRef} className='absolute hidden group-hover:flex items-center gap-1 bg-white/80 px-3 py-1.5 rounded-full text-sm'>
                                    <ImageIcon className='size-4 stroke-gray-600' /> Change
                                </button>
                                <input id='input-project-img' {...register('file' as any, { onChange: (e: any) => setImage(URL.createObjectURL(e.target.files[0])) })} type="file" accept="image/*" className='hidden' />
                            </div>
                        ) : (
                            <>
                                {!image
                                    ? <button ref={btnRef} type='button' className='w-full h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-md flex flex-col justify-center items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors'>
                                        <ImageIcon className='size-8 stroke-current' />
                                        <span className='text-sm'>Click to upload image</span>
                                    </button>
                                    : <div className='h-48 rounded-md overflow-hidden'><img src={image} className='w-full h-full object-cover' alt='' /></div>
                                }
                                <input id='input-project-img' {...register('file' as any, { required: 'Please select an image', onChange: (e: any) => setImage(URL.createObjectURL(e.target.files[0])) })} type="file" accept="image/*" className='hidden' />
                            </>
                        )}
                        <ErrorMsg message={(errors as any)?.file?.message as string} />
                    </div>

                    {/* ── Project Types ── */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-2 uppercase tracking-wide'>
                            Project Type(s) <span className='text-red-400'>*</span>
                            <span className='ml-1 normal-case'>(select one or more)</span>
                        </label>
                        {projectTypes.length === 0 ? (
                            <p className='text-sm text-gray-400 italic'>Loading types…</p>
                        ) : (
                            <div className='grid grid-cols-2 gap-2'>
                                {projectTypes.map((pt) => (
                                    <label key={pt.value} className={`flex items-start gap-2 border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors
                                        ${selectedTypes.includes(pt.value) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                                        <input
                                            type="checkbox"
                                            value={pt.value}
                                            {...register('types')}
                                            className='accent-blue-500 w-4 h-4 mt-0.5 flex-shrink-0'
                                        />
                                        <span className='leading-tight'>
                                            <span className='block text-sm font-medium text-gray-700'>{pt.labelEn}</span>
                                            <span className='block text-xs text-gray-400' dir='rtl'>{pt.labelAr}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {selectedTypes.length === 0 && projectTypes.length > 0 && (
                            <p className='text-red-500 text-xs mt-1'>Please select at least one type</p>
                        )}
                    </div>

                    {/* ── Arabic ── */}
                    <div className='grid grid-cols-1 gap-3 p-3 bg-gray-50 rounded-lg'>
                        <p className='text-xs text-gray-400 uppercase tracking-wide'>Arabic (عربي)</p>
                        <div>
                            <input {...register('title', { required: 'Arabic title is required' })} placeholder='العنوان بالعربية' className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm' dir='rtl' />
                            <ErrorMsg message={errors?.title?.message as string} />
                        </div>
                        <div>
                            <textarea {...register('description', { required: 'Arabic description is required' })} placeholder='الوصف بالعربية' className='w-full h-20 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm' dir='rtl' />
                            <ErrorMsg message={errors?.description?.message as string} />
                        </div>
                    </div>

                    {/* ── English ── */}
                    <div className='grid grid-cols-1 gap-3 p-3 bg-gray-50 rounded-lg'>
                        <p className='text-xs text-gray-400 uppercase tracking-wide'>English</p>
                        <div>
                            <input {...register('titleEn', { required: 'English title is required' })} placeholder='Title in English' className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm' />
                            <ErrorMsg message={errors?.titleEn?.message as string} />
                        </div>
                        <div>
                            <textarea {...register('descriptionEn', { required: 'English description is required' })} placeholder='Description in English' className='w-full h-20 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm' />
                            <ErrorMsg message={errors?.descriptionEn?.message as string} />
                        </div>
                    </div>

                    {/* ── Links ── */}
                    <div>
                        <div className='flex justify-between items-center mb-2'>
                            <label className='text-xs text-gray-400 uppercase tracking-wide'>Project Links</label>
                            <button type='button' onClick={() => append({ headerEn: '', headerAr: '', link: '' })}
                                className='text-xs text-blue-600 border border-blue-300 rounded px-2.5 py-1 hover:bg-blue-50 transition-colors'>
                                + Add Link
                            </button>
                        </div>
                        <div className='space-y-2'>
                            {fields.map((field, index) => (
                                <div key={field.id} className='border rounded-lg p-3 space-y-2 bg-gray-50'>
                                    <div className='flex justify-between items-center'>
                                        <p className='text-xs font-semibold text-gray-500'>Link #{index + 1}</p>
                                        <button type='button' onClick={() => remove(index)} className='text-gray-300 hover:text-red-500'>
                                            <CloseIcon className='size-4' />
                                        </button>
                                    </div>
                                    <div className='grid grid-cols-2 gap-2'>
                                        <input {...register(`links.${index}.headerEn`)} placeholder='Label EN (e.g. WEB)' className='border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm w-full' />
                                        <input {...register(`links.${index}.headerAr`)} placeholder='التسمية (مثال: ويب)' className='border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm w-full' dir='rtl' />
                                    </div>
                                    <input {...register(`links.${index}.link`)} placeholder='https://...' className='border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm w-full' type='url' />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Important ── */}
                    <label className='flex cursor-pointer items-center justify-between py-2'>
                        <span className='text-sm text-gray-600'>Mark as Important / مميز</span>
                        <div className='relative inline-block'>
                            <input {...register('important')} type='checkbox' className='peer h-6 w-12 cursor-pointer appearance-none rounded-full border border-gray-300 bg-white checked:border-blue-500 transition-colors' />
                            <span className='pointer-events-none absolute left-1 top-1 block h-4 w-4 rounded-full bg-gray-400 transition-all duration-200 peer-checked:left-7 peer-checked:bg-blue-500'></span>
                        </div>
                    </label>

                    <button type='submit' className='bg-blue-500 hover:bg-blue-600 py-2.5 rounded-lg w-full text-white flex justify-center font-medium transition-colors'>
                        {loading ? <LoadingIcon className='animate-spin size-5' /> : (editProject ? 'Update Project' : 'Add Project')}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default AddEditProject
