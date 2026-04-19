/* eslint-disable @next/next/no-img-element */
'use client'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, ImageIcon, LoadingIcon } from '../../components/icons'
import ErrorMsg from '../../components/ErrorMsg'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const AddEditProject = ({ type }: { type: string }) => {
    const { addProject, editProject, setEditProject, updateProject, addApp, updateApp }: any = useStore();
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const { register, formState: { errors }, handleSubmit, reset } = useForm();
    const btnRef = useRef<any>(null);
    const router = useRouter();
    const pathname = usePathname()
    const close = () => {
        router.push(pathname)
        setEditProject(null)
        document.body.style.overflowY = "auto"
    }
    const eleRef = useClickOutside(close)
    const onSubmit = async (dataForm: any) => {
        try {
            setLoading(true)
            const formData = new FormData();
            formData.append('img', dataForm.file[0]);
            formData.append('title', dataForm.title);
            formData.append('description', dataForm.description);
            formData.append('titleEn', dataForm.titleEn);
            formData.append('descriptionEn', dataForm.descriptionEn);
            formData.append('important', dataForm.important)
            formData.append('type', type)
            const { data } = await axios.post(`/api/project`, formData);
            if (type == 'app') {
                addApp(data.project)
            } else {
                addProject(data.project)
            }
            toast.success(data.message as string)
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
            const formData = new FormData();
            formData.append('oldImg', editProject?.img as string)
            formData.append('img', dataForm.file[0]);
            formData.append('title', dataForm.title);
            formData.append('description', dataForm.description);
            formData.append('titleEn', dataForm.titleEn);
            formData.append('descriptionEn', dataForm.descriptionEn);
            formData.append('important', dataForm?.important);

            const { data } = await axios.put(`/api/project/${editProject.id}`, formData);
            toast.success(data.message as string)
            if (type == 'app') {
                updateApp(data.project)
            } else {
                updateProject(data.project)
            }
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
                            <h6 className='font-bold '>{editProject ? 'Edit Project' : "Add Project"}</h6>
                            <button onClick={close}><CloseIcon className='size-6' /></button>
                        </div>
                        <form onSubmit={handleSubmit(editProject ? handleupdateProject : onSubmit)} className='px-5 pb-5 space-y-3'>
                            <div>
                                <div className=''>
                                    <>
                                        {
                                            editProject?.img ?
                                                <div className='relative flex justify-center items-center group'>
                                                    <img
                                                        src={image ? image : editProject.img}
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
                                        value: editProject?.title || "",
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
                                        value: editProject?.description || "",
                                    })}
                                    placeholder='Description'
                                    className='w-full h-32 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                />
                                <ErrorMsg message={errors?.description?.message as string} />
                            </div>
                            <div>
                                <input
                                    {...register('titleEn', {
                                        required: "Please Enter Title English..",
                                        value: editProject?.titleEn || "",
                                    })}
                                    placeholder='Title English'
                                    className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                    type="text"
                                />
                                <ErrorMsg message={errors?.titleEn?.message as string} />
                            </div>

                            <div>
                                <textarea
                                    {...register('descriptionEn', {
                                        required: "Please Enter Description..",
                                        value: editProject?.descriptionEn || "",
                                    })}
                                    placeholder='Description English'
                                    className='w-full h-32 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                />
                                <ErrorMsg message={errors?.descriptionEn?.message as string} />
                            </div>
                            {/* <div>
                                <select
                                    {...register('type', {
                                        required: "Please Enter type..",
                                        value: editProject?.type || "project",
                                    })}
                                    className='w-full resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-2'
                                >
                                    <option value="project">Project</option>
                                    <option value="application">Application</option>
                                </select>
                                <ErrorMsg message={errors?.type?.message as string} />
                            </div> */}
                            <label className="flex cursor-pointer items-center justify-between ">
                                <span className='text-gray-400'>Important</span>
                                <div className="relative inline-block">
                                    <input
                                        {...register('important', {
                                            value: editProject?.important
                                        })}
                                        type="checkbox" className="peer h-6 w-12 cursor-pointer appearance-none rounded-full border border-gray-300 bg-white checked:border-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2" />
                                    <span className="pointer-events-none absolute left-1 top-1 block h-4 w-4 rounded-full bg-gray-400 transition-all duration-200 peer-checked:left-7 peer-checked:bg-gray-900"></span>
                                </div>
                            </label>
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

export default AddEditProject