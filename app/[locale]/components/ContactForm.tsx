'use client';
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import ErrorMsg from './ErrorMsg';
import toast from 'react-hot-toast';
import axios from 'axios';
import { LoadingIcon } from './icons';
import { useTranslations } from 'next-intl';

const ContactForm = () => {
    const t = useTranslations('contact.form')
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, formState: { errors }, reset } = useForm()
    const onSubmit = async (formData: any) => {
        try {
            setLoading(true)
            const { data } = await axios.post("/api/contact", formData);
            toast.success(data.message as string)
            reset()
            setLoading(false)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className='bg-[#E5E8EF] py-10 px-5 lg:px-10 rounded-lg space-y-5 shadow-lg'>
                <div>
                    <label className='space-y-3'>
                        <span className='block font-bold'>
                            {t("name.label")}
                        </span>
                        <input
                            className='w-full py-2 rounded-lg text-right outline-none px-2'
                            {...register('name', { required: t('name.error') })}
                            type="text"
                        />
                    </label>
                    <ErrorMsg message={errors?.name?.message as string} />
                </div>
                <div>
                    <label className='space-y-3'>
                        <span className='block font-bold'>
                            {t("email.label")}
                        </span>
                        <input
                            className='w-full py-2 rounded-lg text-right outline-none px-2'
                            {...register('email', { required: t('email.error') })}
                            type="email"
                        />
                    </label>
                    <ErrorMsg message={errors?.email?.message as string} />
                </div>
                <div>
                    <label className='space-y-3'>
                        <span className='block font-bold'>
                            {t("subject.label")}
                        </span>
                        <input
                            className='w-full py-2 rounded-lg text-right outline-none px-2'
                            {...register('subject', { required: t('subject.error') })}
                            type="text"
                        />
                    </label>
                    <ErrorMsg message={errors?.subject?.message as string} />
                </div>
                <div>
                    <label className='space-y-3'>
                        <span className='block font-bold'>
                            {t("message.label")}
                        </span>
                        <textarea
                            className='w-full py-2 rounded-lg text-right outline-none px-2 h-44 resize-none'
                            {...register('message', { required: t('message.error') })}
                        />
                    </label>
                    <ErrorMsg message={errors?.message?.message as string} />
                </div>
                <div className='flex justify-center'>
                    <button disabled={loading} className='bg-gradient-to-r from-[#268F79] to-[#0B2923] px-5 py-3 rounded-md'>
                        <span className='text-[#00FFB2] font-bold'>
                            {loading ? <LoadingIcon className='animate-spin size-5' /> : t("btn")}
                        </span>
                    </button>
                </div>
            </div>
        </form>
    )
}

export default ContactForm