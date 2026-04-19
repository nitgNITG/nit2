/* eslint-disable @next/next/no-img-element */
'use client'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, ImageIcon, LoadingIcon } from '../../components/icons'
import ErrorMsg from '../../components/ErrorMsg'
import { useStore } from '@/lib/zustand';
import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const AddSponser = () => {
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const { register, formState: { errors }, handleSubmit, reset } = useForm();
    const btnRef = useRef<any>(null);
    const router = useRouter();
    const { setSponser }: any = useStore()
    const pathname = usePathname()
    const close = () => {
        router.push(pathname)
    }
    const eleRef = useClickOutside(close)
    useEffect(() => {
        const input = document.getElementById('input-sponser-img');
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
            const { data } = await axios.post('/api/sponser', formData);
            setSponser(data.sponser)
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
    return (
        <div className='w-full h-full fixed bg-black/20 top-0 left-0 flex justify-center items-center px-5 z-50'>
            <div ref={eleRef} className='bg-white w-full sm:w-[420px] md:w-[500px] lg:w-[550px] rounded-md max-h-[95svh] px-5 py-5'>
                <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
                    <div className=' flex justify-between items-center'>
                        <h6 className='font-bold '>Add Sponser</h6>
                        <button onClick={close}><CloseIcon className='size-6' /></button>
                    </div>
                    <div>
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
                            id='input-sponser-img'
                            {...register('file', {
                                required: "Please Enter Image..",
                                onChange: (event) => {
                                    setImage(URL.createObjectURL(event.target.files[0]))
                                },
                            })}
                            type="file"
                            className='hidden'
                        />
                    </div>
                    <ErrorMsg message={errors?.file?.message as string} />
                    <button className='bg-blue-500 py-2 rounded-md w-full text-white flex justify-center'>
                        {loading ? <LoadingIcon className='animate-spin size-5' /> : "Add"}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default AddSponser