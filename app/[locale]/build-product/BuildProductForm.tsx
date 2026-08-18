'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/navigation'

type FormValues = {
    name: string
    slug: string
    tier: string
    _hp?: string // honeypot — stays empty for humans
}

type Plan = {
    id: string
    tier: string
    nameAr: string
    nameEn: string
    price: number
    currency: string
    featuresAr: string[]
    featuresEn: string[]
}

type SuccessInfo = { slug: string; branch: string }

const BuildProductForm = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
    const t = useTranslations('BuildProduct')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ defaultValues: { name: '', slug: '', tier: 'demo', _hp: '' } })

    const [done, setDone] = useState<SuccessInfo | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const slugPreview = (watch('slug') || '').toLowerCase().trim()
    const selectedTier = watch('tier')

    // Load the Moodle plans (packages) so the client picks one → drives the licence tier.
    useEffect(() => {
        fetch('/api/plans?service=moodle')
            .then((r) => r.json())
            .then((d) => {
                const list: Plan[] = Array.isArray(d) ? d : d.plans || d.data || []
                if (list.length) setPlans(list)
            })
            .catch(() => { })
    }, [])

    const onSubmit = async (values: FormValues) => {
        try {
            const res = await fetch('/api/academies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: values.name, slug: values.slug.toLowerCase().trim(), tier: values.tier, _hp: values._hp }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data?.error || t('errorGeneric'))
                return
            }
            toast.success(t('successToast'))
            reset()
            // In the dashboard modal we hand control back (close + refresh);
            // on the standalone page we show the success card.
            if (onSuccess) { onSuccess(); return }
            setDone({ slug: data.slug, branch: data.branch })
        } catch {
            toast.error(t('errorNetwork'))
        }
    }

    // ── Success view ──────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className='w-full max-w-xl mx-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-8 text-center'>
                <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#00FFB2]/15 text-3xl'>
                    🎉
                </div>
                <h3 className='text-2xl font-extrabold text-[#0B2923]'>{t('successTitle')}</h3>
                <p className='mt-2 text-gray-600'>{t('successBody')}</p>

                <div className='mt-6 rounded-xl bg-[#0B2923]/[0.03] ring-1 ring-black/5 p-4 text-start'>
                    <p className='text-sm text-gray-500'>{t('yourIdentifier')}</p>
                    <p className='mt-1 font-mono text-lg font-bold text-[#1E7D67]' dir='ltr'>{done.slug}</p>
                    <p className='mt-3 text-sm text-gray-500'>{t('yourBranch')}</p>
                    <p className='mt-1 font-mono text-sm text-[#0B2923]' dir='ltr'>{done.branch}</p>
                </div>

                <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
                    <Link
                        href='/account'
                        className='inline-block rounded-full bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-2.5 font-bold text-[#00FFB2] transition-transform hover:scale-[1.02]'
                    >
                        {t('goToDashboard')}
                    </Link>
                    <button
                        type='button'
                        onClick={() => setDone(null)}
                        className='inline-block rounded-full px-6 py-2.5 font-bold text-[#1E7D67] hover:bg-[#1E7D67]/5'
                    >
                        {t('createAnother')}
                    </button>
                </div>
            </div>
        )
    }

    // ── Form view ─────────────────────────────────────────────────────────────
    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className='w-full max-w-xl mx-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-6 sm:p-8'
            noValidate
        >
            {/* Academy name (Arabic display name) */}
            <div className='mb-5'>
                <label htmlFor='name' className='mb-1.5 block font-bold text-[#0B2923]'>
                    {t('nameLabel')} <span className='text-red-500'>*</span>
                </label>
                <input
                    id='name'
                    type='text'
                    placeholder={t('namePlaceholder')}
                    className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                    {...register('name', {
                        required: t('nameRequired'),
                        minLength: { value: 2, message: t('nameRequired') },
                    })}
                />
                {errors.name && <p className='mt-1 text-sm text-red-500'>{errors.name.message}</p>}
            </div>

            {/* English identifier (slug → branch + future subdomain) */}
            <div className='mb-2'>
                <label htmlFor='slug' className='mb-1.5 block font-bold text-[#0B2923]'>
                    {t('slugLabel')} <span className='text-red-500'>*</span>
                </label>
                <input
                    id='slug'
                    type='text'
                    dir='ltr'
                    placeholder='ahmed-academy'
                    className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#1E7D67] focus:bg-white ${isAr ? 'text-right' : ''}`}
                    {...register('slug', {
                        required: t('slugRequired'),
                        pattern: { value: /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, message: t('slugInvalid') },
                    })}
                />
                <p className='mt-1.5 text-sm text-gray-500'>{t('slugHint')}</p>
                {errors.slug && <p className='mt-1 text-sm text-red-500'>{errors.slug.message}</p>}
            </div>

            {/* Live preview of what will be created */}
            {slugPreview && (
                <div className='mb-5 rounded-lg bg-[#1E7D67]/5 px-4 py-2 text-sm text-[#1E7D67]' dir='ltr'>
                    {t('previewLabel')}: <span className='font-mono font-bold'>client/{slugPreview}</span>
                </div>
            )}

            {/* Plan picker → drives the local_license tier */}
            {plans.length > 0 && (
                <div className='mb-5'>
                    <label className='mb-1.5 block font-bold text-[#0B2923]'>
                        {isAr ? 'الباقة' : 'Plan'} <span className='text-red-500'>*</span>
                    </label>
                    <div className='grid grid-cols-2 gap-2'>
                        {plans.map((p) => {
                            const on = selectedTier === p.tier
                            return (
                                <button
                                    type='button'
                                    key={p.id}
                                    onClick={() => setValue('tier', p.tier)}
                                    className={`text-start rounded-xl border p-3 transition-colors ${on ? 'border-[#1E7D67] bg-[#1E7D67]/5 ring-1 ring-[#1E7D67]' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                                >
                                    <div className='flex items-baseline justify-between gap-2'>
                                        <span className='font-bold text-[#0B2923]'>{isAr ? p.nameAr : p.nameEn}</span>
                                        <span className='text-sm font-bold text-[#1E7D67]' dir='ltr'>
                                            {p.price === 0 ? (isAr ? 'مجاني' : 'Free') : `$${p.price}`}
                                        </span>
                                    </div>
                                    <ul className='mt-1 list-disc ps-4 text-xs text-gray-500'>
                                        {(isAr ? p.featuresAr : p.featuresEn).slice(0, 3).map((f, i) => (
                                            <li key={i}>{f}</li>
                                        ))}
                                    </ul>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
            <input type='hidden' {...register('tier')} />

            {/* Honeypot — hidden from users, hidden from assistive tech */}
            <input
                type='text'
                tabIndex={-1}
                autoComplete='off'
                aria-hidden='true'
                className='absolute -left-[9999px] h-0 w-0 opacity-0'
                {...register('_hp')}
            />

            <button
                type='submit'
                disabled={isSubmitting}
                className='mt-2 w-full rounded-full bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-3.5 text-lg font-extrabold text-[#00FFB2] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60'
            >
                {isSubmitting ? t('submitting') : t('submit')}
            </button>
        </form>
    )
}

export default BuildProductForm
