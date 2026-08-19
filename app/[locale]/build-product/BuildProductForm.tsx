'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/navigation'

type FormValues = {
    name: string // full name (Arabic) — the primary name
    fullnameEn: string
    shortnameAr: string
    shortnameEn: string
    slug: string
    _hp?: string // honeypot — stays empty for humans
}

type SuccessInfo = { slug: string; branch: string }

// Client-side upload caps — keep the JSON body small enough for the proxy in
// front of the site (see nginx client_max_body_size) and match the server's own
// per-image limit in provision-server.py.
const LOGO_MAX = 1.5 * 1024 * 1024
const FAVICON_MAX = 512 * 1024
const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
const FAVICON_TYPES = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml']

// Strip the "data:...;base64," prefix — the server wants the raw base64 payload.
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => {
            const s = String(r.result)
            const comma = s.indexOf(',')
            resolve(comma >= 0 ? s.slice(comma + 1) : s)
        }
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
    })
}

const BuildProductForm = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
    const t = useTranslations('BuildProduct')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: { name: '', fullnameEn: '', shortnameAr: '', shortnameEn: '', slug: '', _hp: '' },
    })

    const [done, setDone] = useState<SuccessInfo | null>(null)
    const [logo, setLogo] = useState<File | null>(null)
    const [favicon, setFavicon] = useState<File | null>(null)
    const slugPreview = (watch('slug') || '').toLowerCase().trim()

    // Validate an image pick against the type/size caps; toast + reject on fail.
    const pickImage = (
        kind: 'logo' | 'favicon',
        max: number,
        types: string[],
        maxLabel: string,
    ) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null
        const set = kind === 'logo' ? setLogo : setFavicon
        if (!file) { set(null); return }
        if (file.type && types.length && !types.includes(file.type)) {
            toast.error(t('imageBadType'))
            e.target.value = ''
            set(null)
            return
        }
        if (file.size > max) {
            toast.error(t('imageTooLarge', { max: maxLabel }))
            e.target.value = ''
            set(null)
            return
        }
        set(file)
    }

    const onSubmit = async (values: FormValues) => {
        try {
            const brand: Record<string, unknown> = {
                fullname_ar: values.name?.trim() || undefined,
                fullname_en: values.fullnameEn?.trim() || undefined,
                shortname_ar: values.shortnameAr?.trim() || undefined,
                shortname_en: values.shortnameEn?.trim() || undefined,
            }
            if (logo) brand.logo = { filename: logo.name, data_b64: await fileToBase64(logo) }
            if (favicon) brand.favicon = { filename: favicon.name, data_b64: await fileToBase64(favicon) }

            const res = await fetch('/api/academies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    slug: values.slug.toLowerCase().trim(),
                    brand,
                    _hp: values._hp,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data?.error || t('errorGeneric'))
                return
            }
            toast.success(t('successToast'))
            reset()
            setLogo(null)
            setFavicon(null)
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

            {/* Full name (English) — optional; enables the per-language site name */}
            <div className='mb-5'>
                <label htmlFor='fullnameEn' className='mb-1.5 block font-bold text-[#0B2923]'>
                    {t('fullnameEnLabel')}{' '}
                    <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                </label>
                <input
                    id='fullnameEn'
                    type='text'
                    dir='ltr'
                    placeholder={t('fullnameEnPlaceholder')}
                    className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white ${isAr ? 'text-right' : ''}`}
                    {...register('fullnameEn')}
                />
            </div>

            {/* Short name (Arabic + English) — optional */}
            <div className='mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div>
                    <label htmlFor='shortnameAr' className='mb-1.5 block font-bold text-[#0B2923]'>
                        {t('shortnameArLabel')}{' '}
                        <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='shortnameAr'
                        type='text'
                        placeholder={t('shortnameArPlaceholder')}
                        className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                        {...register('shortnameAr')}
                    />
                </div>
                <div>
                    <label htmlFor='shortnameEn' className='mb-1.5 block font-bold text-[#0B2923]'>
                        {t('shortnameEnLabel')}{' '}
                        <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='shortnameEn'
                        type='text'
                        dir='ltr'
                        placeholder={t('shortnameEnPlaceholder')}
                        className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white ${isAr ? 'text-right' : ''}`}
                        {...register('shortnameEn')}
                    />
                </div>
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

            {/* Branding — logo + favicon (optional, applied during provisioning) */}
            <div className='mb-5 mt-6 border-t border-gray-100 pt-5'>
                <p className='mb-3 font-bold text-[#0B2923]'>
                    {t('brandingSectionTitle')}{' '}
                    <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                </p>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    {/* Logo */}
                    <div>
                        <label htmlFor='logo' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                            {t('logoLabel')}
                        </label>
                        <input
                            id='logo'
                            type='file'
                            accept='image/png,image/svg+xml,image/jpeg,image/webp'
                            onChange={pickImage('logo', LOGO_MAX, LOGO_TYPES, '1.5 MB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        <p className='mt-1.5 text-xs text-gray-500'>{t('logoHint')}</p>
                        {logo && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{logo.name}</p>}
                    </div>
                    {/* Favicon */}
                    <div>
                        <label htmlFor='favicon' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                            {t('faviconLabel')}
                        </label>
                        <input
                            id='favicon'
                            type='file'
                            accept='image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml'
                            onChange={pickImage('favicon', FAVICON_MAX, FAVICON_TYPES, '512 KB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        <p className='mt-1.5 text-xs text-gray-500'>{t('faviconHint')}</p>
                        {favicon && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{favicon.name}</p>}
                    </div>
                </div>
            </div>

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
