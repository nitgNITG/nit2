'use client';
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import ErrorMsg from './ErrorMsg';
import toast from 'react-hot-toast';
import axios from 'axios';
import { LoadingIcon } from './icons';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';

const inputCls = 'w-full py-2 rounded-lg outline-none px-3 bg-white';
const selectCls = 'w-full py-2 rounded-lg outline-none px-3 bg-white appearance-none cursor-pointer';

const COUNTRY_CODES = [
    { code: '+966', flag: '🇸🇦', name: 'السعودية' },
    { code: '+971', flag: '🇦🇪', name: 'الإمارات' },
    { code: '+974', flag: '🇶🇦', name: 'قطر' },
    { code: '+965', flag: '🇰🇼', name: 'الكويت' },
    { code: '+973', flag: '🇧🇭', name: 'البحرين' },
    { code: '+968', flag: '🇴🇲', name: 'عُمان' },
    { code: '+962', flag: '🇯🇴', name: 'الأردن' },
    { code: '+20',  flag: '🇪🇬', name: 'مصر' },
    { code: 'other', flag: '🌍', name: '...' },
];

/** Capture UTM params + referrer from the browser */
function useTrackingData() {
    const [tracking, setTracking] = useState({
        sourcePage: '',
        sourceRef: '',
        utmSource: '',
        utmMedium: '',
        utmCampaign: '',
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setTracking({
            sourcePage:  window.location.pathname,
            sourceRef:   document.referrer ? new URL(document.referrer).hostname : 'direct',
            utmSource:   params.get('utm_source')   ?? '',
            utmMedium:   params.get('utm_medium')   ?? '',
            utmCampaign: params.get('utm_campaign') ?? '',
        });
    }, []);

    return tracking;
}

const ContactForm = () => {
    const t = useTranslations('contact.form');
    const locale = useLocale();
    const isAr = locale === 'ar';
    const [loading, setLoading] = useState(false);
    const [dialCode, setDialCode] = useState('+20');
    const [customDial, setCustomDial] = useState('');
    const tracking = useTrackingData();
    const { register, handleSubmit, formState: { errors }, reset } = useForm();

    const onSubmit = async (formData: any) => {
        try {
            setLoading(true);
            const resolvedDial = dialCode === 'other' ? customDial.trim() : dialCode;
            const payload = {
                ...formData,
                phone: resolvedDial ? `${resolvedDial}${formData.phone}` : formData.phone,
                // tracking
                sourcePage:  tracking.sourcePage,
                sourceRef:   tracking.sourceRef,
                utmSource:   tracking.utmSource   || undefined,
                utmMedium:   tracking.utmMedium   || undefined,
                utmCampaign: tracking.utmCampaign || undefined,
            };
            const { data } = await axios.post('/api/contact', payload);
            toast.success(data.message as string);
            reset();
            setDialCode('+20');
            setCustomDial('');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error');
        } finally {
            setLoading(false);
        }
    };

    const dir = isAr ? 'rtl' : 'ltr';

    return (
        <form onSubmit={handleSubmit(onSubmit)} dir={dir}>
            {/* Honeypot */}
            <input type="text" {...register('_hp')} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

            <div className='bg-[#E5E8EF] py-10 px-5 lg:px-10 rounded-lg space-y-5 shadow-lg'>

                {/* ── Name + Email ─────────────────────────── */}
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

                {/* ── Phone ──────────────────────── */}
                <div>
                    <label className='space-y-2 block'>
                        <span className='block font-bold text-sm'>{t('phone.label')} <span className='text-red-500'>*</span></span>
                        <div className='flex gap-2' dir='ltr'>
                            <select
                                value={dialCode}
                                onChange={e => setDialCode(e.target.value)}
                                className='py-2 rounded-lg outline-none px-2 bg-white border border-gray-200 text-sm font-semibold cursor-pointer flex-shrink-0'
                                style={{ minWidth: '100px' }}
                            >
                                {COUNTRY_CODES.map(c => (
                                    <option key={c.code} value={c.code}>
                                        {c.flag} {c.code === 'other' ? t('phone.other') : c.code}
                                    </option>
                                ))}
                            </select>
                            {dialCode === 'other' && (
                                <input
                                    type='text'
                                    value={customDial}
                                    onChange={e => setCustomDial(e.target.value)}
                                    placeholder='+??'
                                    className='w-16 py-2 rounded-lg outline-none px-2 bg-white border border-gray-200 text-sm text-center'
                                    dir='ltr'
                                />
                            )}
                            <input
                                className='flex-1 min-w-0 py-2 rounded-lg outline-none px-3 bg-white'
                                {...register('phone', { required: t('phone.error') })}
                                type='tel'
                                dir='ltr'
                                placeholder='5xxxxxxxx'
                            />
                        </div>
                    </label>
                    <ErrorMsg message={errors?.phone?.message as string} />
                </div>

                {/* ── Subject ──────────────────────── */}
                <div>
                    <label className='space-y-2 block'>
                        <span className='block font-bold text-sm'>{t('subject.label')} <span className='text-red-500'>*</span></span>
                        <input className={clsx(inputCls, isAr ? 'text-right' : 'text-left')}
                            {...register('subject', { required: t('subject.error') })} type='text' />
                    </label>
                    <ErrorMsg message={errors?.subject?.message as string} />
                </div>

                {/* ── Qualifying fields ────────────────────── */}
                <div className='border-t border-gray-300 pt-4 space-y-4'>
                    <p className='text-sm font-semibold text-[#1E7D67]'>— {t('qualify')} —</p>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                            <label className='space-y-2 block'>
                                <span className='block font-bold text-sm'>{t('country.label')}</span>
                                <select className={clsx(selectCls, isAr ? 'text-right' : 'text-left')} {...register('country')}>
                                    <option value=''>{t('country.placeholder')}</option>
                                    <option value='sa'>{t('country.options.sa')}</option>
                                    <option value='ae'>{t('country.options.ae')}</option>
                                    <option value='qa'>{t('country.options.qa')}</option>
                                    <option value='kw'>{t('country.options.kw')}</option>
                                    <option value='bh'>{t('country.options.bh')}</option>
                                    <option value='om'>{t('country.options.om')}</option>
                                    <option value='jo'>{t('country.options.jo')}</option>
                                    <option value='eg'>{t('country.options.eg')}</option>
                                    <option value='other'>{t('country.options.other')}</option>
                                </select>
                            </label>
                        </div>
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
                    <button disabled={loading} className='bg-gradient-to-r from-[#1E7D67] to-[#0B2923] px-8 py-3 rounded-md'>
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
