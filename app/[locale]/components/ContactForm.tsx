'use client';
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import ErrorMsg from './ErrorMsg';
import toast from 'react-hot-toast';
import axios from 'axios';
import { LoadingIcon } from './icons';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';

const inputCls = 'w-full py-2 rounded-lg outline-none px-3 bg-white';
const selectCls = 'w-full py-2 rounded-lg outline-none px-3 bg-white appearance-none cursor-pointer';

const ContactForm = () => {
    const t = useTranslations('contact.form');
    const locale = useLocale();
    const isAr = locale === 'ar';
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, formState: { errors }, reset } = useForm();

    const onSubmit = async (formData: any) => {
        try {
            setLoading(true);
            const { data } = await axios.post('/api/contact', formData);
            toast.success(data.message as string);
            reset();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error');
        } finally {
            setLoading(false);
        }
    };

    const dir = isAr ? 'rtl' : 'ltr';

    return (
        <form onSubmit={handleSubmit(onSubmit)} dir={dir}>
            <div className='bg-[#E5E8EF] py-10 px-5 lg:px-10 rounded-lg space-y-5 shadow-lg'>

                {/* ── Required fields ──────────────────────── */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                        <label className='space-y-2 block'>
                            <span className='block font-bold text-sm'>{t('name.label')} <span className='text-red-500'>*</span></span>
                            <input className={clsx(inputCls, isAr ? 'text-right' : 'text-left')}
                                {...register('name', { required: t('name.error') })} type='text' />
                        </label>
                        <ErrorMsg message={errors?.name?.message as string} />
                    </div>
                    <div>
                        <label className='space-y-2 block'>
                            <span className='block font-bold text-sm'>{t('email.label')} <span className='text-red-500'>*</span></span>
                            <input className={clsx(inputCls, 'text-left')}
                                {...register('email', { required: t('email.error') })} type='email' dir='ltr' />
                        </label>
                        <ErrorMsg message={errors?.email?.message as string} />
                    </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                        <label className='space-y-2 block'>
                            <span className='block font-bold text-sm'>{t('phone.label')}</span>
                            <input className={clsx(inputCls, 'text-left')}
                                {...register('phone')} type='tel' dir='ltr' />
                        </label>
                    </div>
                    <div>
                        <label className='space-y-2 block'>
                            <span className='block font-bold text-sm'>{t('subject.label')} <span className='text-red-500'>*</span></span>
                            <input className={clsx(inputCls, isAr ? 'text-right' : 'text-left')}
                                {...register('subject', { required: t('subject.error') })} type='text' />
                        </label>
                        <ErrorMsg message={errors?.subject?.message as string} />
                    </div>
                </div>

                {/* ── Qualifying fields ────────────────────── */}
                <div className='border-t border-gray-300 pt-4 space-y-4'>
                    <p className='text-sm font-semibold text-[#268F79]'>— {t('qualify')} —</p>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {/* Service */}
                        <div>
                            <label className='space-y-2 block'>
                                <span className='block font-bold text-sm'>{t('service.label')}</span>
                                <select className={clsx(selectCls, isAr ? 'text-right' : 'text-left')} {...register('service')}>
                                    <option value=''>{t('service.placeholder')}</option>
                                    <option value='moodle'>{t('service.options.moodle')}</option>
                                    <option value='ecommerce'>{t('service.options.ecommerce')}</option>
                                    <option value='custom'>{t('service.options.custom')}</option>
                                    <option value='other'>{t('service.options.other')}</option>
                                </select>
                            </label>
                        </div>

                        {/* Budget */}
                        <div>
                            <label className='space-y-2 block'>
                                <span className='block font-bold text-sm'>{t('budget.label')}</span>
                                <select className={clsx(selectCls, isAr ? 'text-right' : 'text-left')} {...register('budget')}>
                                    <option value=''>{t('budget.placeholder')}</option>
                                    <option value='under5k'>{t('budget.options.under5k')}</option>
                                    <option value='5to20k'>{t('budget.options.5to20k')}</option>
                                    <option value='20to50k'>{t('budget.options.20to50k')}</option>
                                    <option value='above50k'>{t('budget.options.above50k')}</option>
                                    <option value='unknown'>{t('budget.options.unknown')}</option>
                                </select>
                            </label>
                        </div>

                        {/* Timeline */}
                        <div>
                            <label className='space-y-2 block'>
                                <span className='block font-bold text-sm'>{t('timeline.label')}</span>
                                <select className={clsx(selectCls, isAr ? 'text-right' : 'text-left')} {...register('timeline')}>
                                    <option value=''>{t('timeline.placeholder')}</option>
                                    <option value='immediate'>{t('timeline.options.immediate')}</option>
                                    <option value='1to3months'>{t('timeline.options.1to3months')}</option>
                                    <option value='3to6months'>{t('timeline.options.3to6months')}</option>
                                    <option value='exploring'>{t('timeline.options.exploring')}</option>
                                </select>
                            </label>
                        </div>

                        {/* Role */}
                        <div>
                            <label className='space-y-2 block'>
                                <span className='block font-bold text-sm'>{t('role.label')}</span>
                                <select className={clsx(selectCls, isAr ? 'text-right' : 'text-left')} {...register('role')}>
                                    <option value=''>{t('role.placeholder')}</option>
                                    <option value='owner'>{t('role.options.owner')}</option>
                                    <option value='manager'>{t('role.options.manager')}</option>
                                    <option value='employee'>{t('role.options.employee')}</option>
                                    <option value='other'>{t('role.options.other')}</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Pain / Challenge */}
                    <div>
                        <label className='space-y-2 block'>
                            <span className='block font-bold text-sm'>{t('pain.label')}</span>
                            <textarea
                                className={clsx(inputCls, 'h-20 resize-none', isAr ? 'text-right' : 'text-left')}
                                placeholder={t('pain.placeholder')}
                                {...register('pain')}
                            />
                        </label>
                    </div>
                </div>

                {/* ── Message ──────────────────────────────── */}
                <div>
                    <label className='space-y-2 block'>
                        <span className='block font-bold text-sm'>{t('message.label')} <span className='text-red-500'>*</span></span>
                        <textarea
                            className={clsx(inputCls, 'h-32 resize-none', isAr ? 'text-right' : 'text-left')}
                            {...register('message', { required: t('message.error') })}
                        />
                    </label>
                    <ErrorMsg message={errors?.message?.message as string} />
                </div>

                <div className='flex justify-center pt-2'>
                    <button disabled={loading} className='bg-gradient-to-r from-[#268F79] to-[#0B2923] px-8 py-3 rounded-md'>
                        <span className='text-[#00FFB2] font-bold'>
                            {loading ? <LoadingIcon className='animate-spin size-5' /> : t('btn')}
                        </span>
                    </button>
                </div>
            </div>
        </form>
    );
};

export default ContactForm;
