'use client';
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import ErrorMsg from './ErrorMsg';
import toast from 'react-hot-toast';
import axios from 'axios';
import { LoadingIcon } from './icons';
import { useTranslations, useLocale } from 'next-intl';
import clsx from 'clsx';
import { trackLead } from '@/lib/leadTracking';

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

type WhatsappVerify = { url: string; code: string };

/** The API's optional `whatsappVerify` (only when WhatsApp verification is on) — only a real wa.me link is used. */
function readWhatsappVerify(data: any): WhatsappVerify | null {
    const v = data?.whatsappVerify;
    if (!v || typeof v.url !== 'string' || typeof v.code !== 'string') return null;
    return v.url.startsWith('https://wa.me/') ? { url: v.url, code: v.code } : null;
}

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

/** `leadType` says which lead a successful submit counts as (the get-quote page reuses this form). */
const ContactForm = ({ leadType = 'contact_submit' }: { leadType?: 'contact_submit' | 'quote_submit' }) => {
    const t = useTranslations('contact.form');
    const locale = useLocale();
    const isAr = locale === 'ar';
    const [loading, setLoading] = useState(false);
    const [dialCode, setDialCode] = useState('+20');
    const [customDial, setCustomDial] = useState('');
    const [waVerify, setWaVerify] = useState<WhatsappVerify | null>(null);
    const tracking = useTrackingData();
    const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

    // Prefill subject + message when arrived from a "Contact us" plan card
    // (/contact?plan=<key>), so sales sees which plan the lead wanted. Read from
    // the URL in an effect (client-only) to avoid a useSearchParams Suspense wrap.
    // Same for "Start a similar project" on a promo (/contact?project=<name>).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const project = params.get('project')?.trim().slice(0, 80);
        if (project) {
            setValue('subject', isAr ? `مشروع مشابه لـ ${project}` : `A project like ${project}`);
            setValue('message', isAr
                ? `مرحباً، شاهدت ${project} وأريد مشروعاً مشابهاً. برجاء التواصل معي.`
                : `Hi, I saw ${project} and I'd like a similar project. Please get in touch.`);
            return;
        }
        const plan = params.get('plan');
        if (!plan) return;
        const nice = plan.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
        setValue('subject', isAr ? `استفسار عن باقة ${nice}` : `${nice} plan — enquiry`);
        setValue('message', isAr
            ? `مرحباً، أنا مهتم بباقة ${nice} لأكاديميتي. برجاء التواصل معي.`
            : `Hi, I'm interested in the ${nice} plan for my academy. Please get in touch.`);
    }, [setValue, isAr]);

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
                locale, // language of the prefilled WhatsApp verification message
            };
            const { data } = await axios.post('/api/contact', payload);
            toast.success(data.message as string);
            setWaVerify(readWhatsappVerify(data));
            trackLead(leadType);
            reset();
            setDialCode('+20');
            setCustomDial('');
        } catch (error: any) {
            toast.error(error?.response?.data?.code === 'invalid_phone'
                ? t('phone.invalid')
                : error?.response?.data?.message || 'There is an Error');
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

                {/* ── WhatsApp verification (only when the API asks for it) ── */}
                {waVerify && (
                    <section
                        aria-labelledby='wa-verify-title'
                        className='bg-white border-2 border-[#25D366] rounded-lg p-5 text-center space-y-3'
                    >
                        <h3 id='wa-verify-title' className='font-bold text-lg text-[#0B2923]'>{t('waVerify.title')}</h3>
                        <p className='text-sm text-gray-600'>{t('waVerify.body')}</p>
                        <a
                            href={waVerify.url}
                            target='_blank'
                            rel='noopener noreferrer'
                            data-lead-ignore
                            className='inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1EBE5A] text-white font-bold px-6 py-3 rounded-md transition-colors'
                        >
                            <svg viewBox='0 0 24 24' aria-hidden='true' className='w-5 h-5 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                            {t('waVerify.btn')}
                        </a>
                        <p className='text-xs text-gray-500'>
                            {t('waVerify.code')}{' '}
                            <span dir='ltr' className='font-mono font-bold text-sm text-[#0B2923] select-all'>{waVerify.code}</span>
                        </p>
                    </section>
                )}
            </div>
        </form>
    );
};

export default ContactForm;
