'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/navigation'
import HomePreview, { DEFAULT_PALETTE, type Palette } from './HomePreview'

// The 6 palette controls the client sets (mapped to theme_nit Brand-Color roles).
const PALETTE_FIELDS: { key: keyof Palette; ar: string; en: string }[] = [
    { key: 'primary', ar: 'اللون الأساسي', en: 'Primary' },
    { key: 'accent', ar: 'لون التمييز', en: 'Accent' },
    { key: 'secondary', ar: 'اللون الثانوي', en: 'Secondary' },
    { key: 'background', ar: 'الخلفية', en: 'Background' },
    { key: 'surface', ar: 'البطاقات', en: 'Surface' },
    { key: 'text', ar: 'النص', en: 'Text' },
]
// Ready-made professional palettes (one click sets all 6): 5 dark + 5 light.
const PALETTE_PRESETS: { name: string; dark: boolean; p: Palette }[] = [
    // ── Dark ──
    { name: 'Slate', dark: true, p: DEFAULT_PALETTE },
    { name: 'Teal', dark: true, p: { primary: '#2f9e8f', accent: '#3fb8a6', secondary: '#10221f', background: '#0a1a17', surface: '#102a25', text: '#eafaf6' } },
    { name: 'Indigo', dark: true, p: { primary: '#7c6cd6', accent: '#9b8cf0', secondary: '#1a1730', background: '#0d0b1a', surface: '#171334', text: '#eeeaff' } },
    { name: 'Ruby', dark: true, p: { primary: '#c2456b', accent: '#e06a8c', secondary: '#2a1420', background: '#170a10', surface: '#241019', text: '#fdeef3' } },
    { name: 'Amber', dark: true, p: { primary: '#d4933a', accent: '#e8b45c', secondary: '#2a2012', background: '#17120a', surface: '#241c10', text: '#fdf5e8' } },
    // ── Light — derived from real academy brand palettes ──
    // Royal navy + gold (al3alamy.com).
    { name: 'Royal', dark: false, p: { primary: '#00126c', accent: '#c9a227', secondary: '#eaeef9', background: '#ffffff', surface: '#f3f5fb', text: '#0b1230' } },
    // Deep teal + warm gold (xmathsacademy.com).
    { name: 'Teal Gold', dark: false, p: { primary: '#0e504d', accent: '#c7ae72', secondary: '#eaf3f1', background: '#ffffff', surface: '#f2f8f6', text: '#14201f' } },
    // Fresh emerald green (kotoof.org).
    { name: 'Emerald', dark: false, p: { primary: '#167b44', accent: '#1f9e57', secondary: '#eaf5ee', background: '#ffffff', surface: '#f2f9f4', text: '#12241a' } },
    // Brick red + navy (3alemny.net).
    { name: 'Brick', dark: false, p: { primary: '#92251e', accent: '#b23a2e', secondary: '#fbeeec', background: '#ffffff', surface: '#fbf4f3', text: '#183041' } },
    // Deep blue + slate (mrfathybakrmathematics.com).
    { name: 'Navy', dark: false, p: { primary: '#003362', accent: '#1f6fb2', secondary: '#e9eef4', background: '#ffffff', surface: '#f2f6fa', text: '#10233a' } },
]
type License = { key: string; name: string; price: number; active: boolean; maxCourses: number; features: Record<string, boolean> }
const FEATURE_LABELS: Record<string, string> = { drm: 'DRM video', coupons: 'coupons', offers: 'offers', subscriptions: 'subscriptions', packages: 'packages', jitsi: 'live sessions' }

type FormValues = {
    name: string // full name (Arabic) — the primary name
    fullnameEn: string
    shortnameAr: string
    shortnameEn: string
    slug: string
    tier: string
    contactPhone: string
    contactWhatsapp: string
    socialFacebook: string
    socialInstagram: string
    socialYoutube: string
    socialTiktok: string
    socialWebsite: string
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
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: { name: '', fullnameEn: '', shortnameAr: '', shortnameEn: '', slug: '', tier: 'demo', contactPhone: '', contactWhatsapp: '', socialFacebook: '', socialInstagram: '', socialYoutube: '', socialTiktok: '', socialWebsite: '', _hp: '' },
    })

    const [done, setDone] = useState<SuccessInfo | null>(null)
    const [licenses, setLicenses] = useState<License[]>([])
    const [logo, setLogo] = useState<File | null>(null)
    const [logocompact, setLogocompact] = useState<File | null>(null)
    const [favicon, setFavicon] = useState<File | null>(null)
    const [platformLang, setPlatformLang] = useState<'ar' | 'en' | 'both'>('both') // academy language
    const hasAr = platformLang !== 'en'
    const hasEn = platformLang !== 'ar'
    const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE) // brand colours
    const setColor = (k: keyof Palette, v: string) => setPalette((p) => ({ ...p, [k]: v }))
    const [hero, setHero] = useState<File | null>(null) // cover/hero image
    const heroUrl = useMemo(() => (hero ? URL.createObjectURL(hero) : null), [hero])
    useEffect(() => () => { if (heroUrl) URL.revokeObjectURL(heroUrl) }, [heroUrl])
    const [about, setAbout] = useState<File | null>(null) // about/instructor photo
    const aboutUrl = useMemo(() => (about ? URL.createObjectURL(about) : null), [about])
    useEffect(() => () => { if (aboutUrl) URL.revokeObjectURL(aboutUrl) }, [aboutUrl])
    const [login, setLogin] = useState<File | null>(null) // login/signup page background
    const loginUrl = useMemo(() => (login ? URL.createObjectURL(login) : null), [login])
    useEffect(() => () => { if (loginUrl) URL.revokeObjectURL(loginUrl) }, [loginUrl])
    const [aboutBullets, setAboutBullets] = useState<string[]>([]) // about points (chips)
    const [bulletDraft, setBulletDraft] = useState('')
    const addBullet = () => {
        const v = bulletDraft.trim()
        if (v && aboutBullets.length < 8 && !aboutBullets.includes(v)) setAboutBullets((a) => [...a, v])
        setBulletDraft('')
    }
    const [gallery, setGallery] = useState<File[]>([]) // up to 8 gallery photos
    const faviconUrl = useMemo(() => (favicon ? URL.createObjectURL(favicon) : null), [favicon])
    useEffect(() => () => { if (faviconUrl) URL.revokeObjectURL(faviconUrl) }, [faviconUrl])
    const galleryUrls = useMemo(() => gallery.map((f) => URL.createObjectURL(f)), [gallery])
    useEffect(() => () => { galleryUrls.forEach((u) => URL.revokeObjectURL(u)) }, [galleryUrls])
    const slugPreview = (watch('slug') || '').toLowerCase().trim()
    const selectedTier = watch('tier')
    const nameWatch = watch('name')

    // Object URL for the picked logo, so the live preview can show it.
    const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo])
    useEffect(() => () => { if (logoUrl) URL.revokeObjectURL(logoUrl) }, [logoUrl])

    // Load the licences (packages) the client can pick from.
    useEffect(() => {
        fetch('/api/licenses')
            .then((r) => r.json())
            .then((d) => {
                const active: License[] = (d.licenses ?? []).filter((l: License) => l.active)
                setLicenses(active)
                if (active.length && !active.some((l) => l.key === watch('tier'))) {
                    setValue('tier', active[0].key)
                }
            })
            .catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Validate an image pick against the type/size caps; toast + reject on fail.
    const pickImage = (
        set: (f: File | null) => void,
        max: number,
        types: string[],
        maxLabel: string,
    ) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null
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
            const nm = values.name?.trim() || undefined
            const brand: Record<string, unknown> = {
                colors: palette, // 6 brand colours → theme_nit Brand-Color roles
                contact_phone: values.contactPhone?.trim() || undefined,
                contact_whatsapp: values.contactWhatsapp?.trim() || undefined,
            }
            // Map the name(s) to the chosen platform language.
            if (platformLang === 'en') {
                brand.fullname_en = nm
                brand.shortname_en = values.shortnameEn?.trim() || undefined
            } else {
                brand.fullname_ar = nm
                brand.shortname_ar = values.shortnameAr?.trim() || undefined
                if (platformLang === 'both') {
                    brand.fullname_en = values.fullnameEn?.trim() || undefined
                    brand.shortname_en = values.shortnameEn?.trim() || undefined
                }
            }
            const social: Record<string, string> = {}
            if (values.socialFacebook?.trim()) social.facebook = values.socialFacebook.trim()
            if (values.socialInstagram?.trim()) social.instagram = values.socialInstagram.trim()
            if (values.socialYoutube?.trim()) social.youtube = values.socialYoutube.trim()
            if (values.socialTiktok?.trim()) social.tiktok = values.socialTiktok.trim()
            if (values.socialWebsite?.trim()) social.website = values.socialWebsite.trim()
            if (Object.keys(social).length) brand.social = social
            if (aboutBullets.length) brand.about_bullets = aboutBullets

            if (logo) brand.logo = { filename: logo.name, data_b64: await fileToBase64(logo) }
            if (logocompact) brand.logocompact = { filename: logocompact.name, data_b64: await fileToBase64(logocompact) }
            if (favicon) brand.favicon = { filename: favicon.name, data_b64: await fileToBase64(favicon) }
            if (hero) brand.hero = { filename: hero.name, data_b64: await fileToBase64(hero) }
            if (about) brand.about = { filename: about.name, data_b64: await fileToBase64(about) }
            if (login) brand.login = { filename: login.name, data_b64: await fileToBase64(login) }
            if (gallery.length) {
                brand.gallery = await Promise.all(
                    gallery.map(async (f) => ({ filename: f.name, data_b64: await fileToBase64(f) })),
                )
            }

            const res = await fetch('/api/academies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    slug: values.slug.toLowerCase().trim(),
                    tier: values.tier,
                    brand,
                    locale,
                    platform_lang: platformLang,
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
            setLogocompact(null)
            setFavicon(null)
            setHero(null)
            setAbout(null)
            setLogin(null)
            setGallery([])
            setAboutBullets([])
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
            {/* ══ 1. Identity — language, name, slug (the essentials) ══ */}
            <p className='mb-4 text-xs font-bold uppercase tracking-wide text-[#1E7D67]'>
                {isAr ? '١ · هوية المنصة' : '1 · Platform identity'}
            </p>

            {/* Platform language — decides which name boxes to show + the academy language */}
            <div className='mb-5'>
                <label className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'لغة المنصة' : 'Platform language'} <span className='text-red-500'>*</span>
                </label>
                <div className='flex gap-2'>
                    {([['both', isAr ? 'عربي + إنجليزي' : 'Arabic + English'], ['ar', 'العربية'], ['en', 'English']] as const).map(([val, label]) => (
                        <button
                            type='button'
                            key={val}
                            onClick={() => setPlatformLang(val)}
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${platformLang === val ? 'border-[#1E7D67] bg-[#1E7D67]/10 text-[#1E7D67] ring-1 ring-[#1E7D67]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Academy name — primary, in the chosen language (always required) */}
            <div className='mb-5'>
                <label htmlFor='name' className='mb-1.5 block font-bold text-[#0B2923]'>
                    {hasAr ? (isAr ? 'اسم الأكاديمية' : 'Academy name (Arabic)') : (isAr ? 'اسم الأكاديمية (إنجليزي)' : 'Academy name')} <span className='text-red-500'>*</span>
                </label>
                <input
                    id='name'
                    type='text'
                    dir={hasAr ? undefined : 'ltr'}
                    placeholder={t('namePlaceholder')}
                    className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                    {...register('name', {
                        required: t('nameRequired'),
                        minLength: { value: 2, message: t('nameRequired') },
                    })}
                />
                {errors.name && <p className='mt-1 text-sm text-red-500'>{errors.name.message}</p>}
            </div>

            {/* English full name — only when BOTH languages are enabled */}
            {platformLang === 'both' && (
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
            )}

            {/* Short name(s) — only for the active language(s), optional */}
            <div className='mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                {hasAr && (
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
                )}
                {hasEn && (
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
                )}
            </div>

            {/* ══ 2. Plan — identifier + licence (required) ══ */}
            <p className='mb-4 mt-8 text-xs font-bold uppercase tracking-wide text-[#1E7D67]'>
                {isAr ? '٢ · المعرّف والباقة' : '2 · Identifier & plan'}
            </p>

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

            {/* Licence picker → the local_license tier the academy is provisioned with */}
            <div className='mb-5'>
                <label className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'الباقة' : 'License'} <span className='text-red-500'>*</span>
                </label>
                <div className='grid grid-cols-2 gap-2'>
                    {licenses.map((lic) => {
                        const on = selectedTier === lic.key
                        const summary = [
                            `${lic.maxCourses < 0 ? (isAr ? 'كورسات بلا حد' : 'unlimited courses') : `${lic.maxCourses} ${isAr ? 'كورسات' : 'courses'}`}`,
                            ...Object.keys(lic.features || {}).filter((f) => lic.features[f]).map((f) => FEATURE_LABELS[f] ?? f),
                        ].slice(0, 3)
                        return (
                            <button
                                type='button'
                                key={lic.key}
                                onClick={() => setValue('tier', lic.key)}
                                className={`text-start rounded-xl border p-3 transition-colors ${on ? 'border-[#1E7D67] bg-[#1E7D67]/5 ring-1 ring-[#1E7D67]' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                            >
                                <div className='flex items-baseline justify-between gap-2'>
                                    <span className='font-bold text-[#0B2923]'>{lic.name}</span>
                                    <span className='text-sm font-bold text-[#1E7D67]' dir='ltr'>
                                        {lic.price === 0 ? (isAr ? 'مجاني' : 'Free') : `$${lic.price}`}
                                    </span>
                                </div>
                                <ul className='mt-1 list-disc ps-4 text-xs text-gray-500'>
                                    {summary.map((f, i) => (
                                        <li key={i}>{f}</li>
                                    ))}
                                </ul>
                            </button>
                        )
                    })}
                </div>
            </div>
            <input type='hidden' {...register('tier')} />

            {/* ══ 3. Branding & appearance — logos, colours, images (optional) ══ */}
            <p className='mb-4 mt-8 text-xs font-bold uppercase tracking-wide text-[#1E7D67]'>
                {isAr ? '٣ · الهوية البصرية' : '3 · Branding & appearance'}
            </p>

            {/* Logo + compact logo + favicon (shown in the live preview below) */}
            <div className='mb-5'>
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
                            onChange={pickImage(setLogo, LOGO_MAX, LOGO_TYPES, '1.5 MB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        <p className='mt-1.5 text-xs text-gray-500'>{t('logoHint')}</p>
                        {logo && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{logo.name}</p>}
                    </div>
                    {/* Compact logo — Moodle's logocompact (emblem/icon) */}
                    <div>
                        <label htmlFor='logocompact' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                            {t('logocompactLabel')}
                        </label>
                        <input
                            id='logocompact'
                            type='file'
                            accept='image/png,image/svg+xml,image/jpeg,image/webp'
                            onChange={pickImage(setLogocompact, LOGO_MAX, LOGO_TYPES, '1.5 MB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        <p className='mt-1.5 text-xs text-gray-500'>{t('logocompactHint')}</p>
                        {logocompact && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{logocompact.name}</p>}
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
                            onChange={pickImage(setFavicon, FAVICON_MAX, FAVICON_TYPES, '512 KB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        <p className='mt-1.5 text-xs text-gray-500'>{t('faviconHint')}</p>
                        {favicon && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{favicon.name}</p>}
                    </div>
                </div>
            </div>

            {/* Brand colours (6 controls → theme_nit roles) + images + live preview */}
            <div className='mb-6'>
                <label className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'ألوان المنصة' : 'Brand colours'}
                </label>

                {/* One-click ready palettes */}
                <div className='mb-3 flex flex-wrap gap-2'>
                    {PALETTE_PRESETS.map((pr) => {
                        const on = JSON.stringify(palette) === JSON.stringify(pr.p)
                        return (
                        <button
                            type='button'
                            key={pr.name}
                            onClick={() => setPalette(pr.p)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-[#1E7D67] bg-[#1E7D67]/10 text-[#1E7D67] ring-1 ring-[#1E7D67]' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                        >
                            <span className='inline-flex'>
                                <span className='h-4 w-4 rounded-full ring-1 ring-black/10' style={{ background: pr.p.primary }} />
                                <span className='-ms-1 h-4 w-4 rounded-full ring-1 ring-black/10' style={{ background: pr.p.background }} />
                            </span>
                            {pr.name}
                        </button>
                        )
                    })}
                </div>

                {/* Individual colour controls */}
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                    {PALETTE_FIELDS.map((f) => (
                        <label key={f.key} className='flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm'>
                            <input
                                type='color'
                                value={palette[f.key]}
                                onChange={(e) => setColor(f.key, e.target.value)}
                                className='h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0'
                                aria-label={isAr ? f.ar : f.en}
                            />
                            <span className='text-gray-600'>{isAr ? f.ar : f.en}</span>
                        </label>
                    ))}
                </div>

                {/* Hero / cover image — shown in the preview + applied on provision */}
                <div className='mt-4'>
                    <label htmlFor='hero' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                        {isAr ? 'صورة الغلاف (الهيرو)' : 'Cover (hero) image'}{' '}
                        <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='hero'
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        onChange={pickImage(setHero, 1.5 * 1024 * 1024, ['image/png', 'image/jpeg', 'image/webp'], '1.5 MB')}
                        className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                    />
                    {hero && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{hero.name}</p>}
                </div>

                {/* About bullet points (chips) */}
                <div className='mt-4'>
                    <label className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                        {isAr ? 'نقاط النبذة (About)' : 'About points'}{' '}
                        <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <div className='flex gap-2'>
                        <input
                            type='text'
                            value={bulletDraft}
                            onChange={(e) => setBulletDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBullet() } }}
                            placeholder={isAr ? 'اكتب نقطة ثم أضف' : 'Type a point, then Add'}
                            className='flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                        />
                        <button type='button' onClick={addBullet} className='rounded-xl bg-[#1E7D67]/10 px-4 py-2.5 text-sm font-semibold text-[#1E7D67] hover:bg-[#1E7D67]/15'>
                            {isAr ? 'أضف' : 'Add'}
                        </button>
                    </div>
                    {aboutBullets.length > 0 && (
                        <div className='mt-2 flex flex-wrap gap-2'>
                            {aboutBullets.map((b, i) => (
                                <span key={i} className='inline-flex items-center gap-1.5 rounded-full bg-[#1E7D67]/10 px-3 py-1 text-xs text-[#0B2923]'>
                                    {b}
                                    <button type='button' onClick={() => setAboutBullets((a) => a.filter((_, j) => j !== i))} className='text-[#1E7D67] hover:text-red-500'>✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* About photo + gallery */}
                <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    <div>
                        <label htmlFor='about' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                            {isAr ? 'صورة قسم "نبذة عن"' : 'About photo'}{' '}
                            <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                        </label>
                        <input
                            id='about'
                            type='file'
                            accept='image/png,image/jpeg,image/webp'
                            onChange={pickImage(setAbout, 1.5 * 1024 * 1024, ['image/png', 'image/jpeg', 'image/webp'], '1.5 MB')}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        {about && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{about.name}</p>}
                    </div>
                    <div>
                        <label htmlFor='gallery' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                            {isAr ? 'صور الألبوم' : 'Gallery photos'}{' '}
                            <span className='text-xs font-normal text-gray-400'>({isAr ? 'حتى 8' : 'up to 8'})</span>
                        </label>
                        <input
                            id='gallery'
                            type='file'
                            multiple
                            accept='image/png,image/jpeg,image/webp'
                            onChange={(e) => {
                                const files = Array.from(e.target.files ?? []).slice(0, 8)
                                const ok = files.filter((f) => f.size <= 1.5 * 1024 * 1024 && ['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
                                if (ok.length < files.length) toast.error(t('imageTooLarge', { max: '1.5 MB' }))
                                setGallery(ok)
                            }}
                            className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                        />
                        {gallery.length > 0 && <p className='mt-1 text-xs text-[#1E7D67]' dir='ltr'>{gallery.length} {isAr ? 'صورة' : 'images'}</p>}
                    </div>
                </div>

                {/* Login / signup page background image */}
                <div className='mt-4'>
                    <label htmlFor='login' className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                        {isAr ? 'صورة خلفية صفحة تسجيل الدخول' : 'Login page background image'}{' '}
                        <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='login'
                        type='file'
                        accept='image/png,image/jpeg,image/webp'
                        onChange={pickImage(setLogin, 1.5 * 1024 * 1024, ['image/png', 'image/jpeg', 'image/webp'], '1.5 MB')}
                        className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                    />
                    <p className='mt-1.5 text-xs text-gray-500'>
                        {isAr
                            ? 'تظهر خلف نموذج تسجيل الدخول والتسجيل. يُضاف تعتيم خفيف تلقائيًا لسهولة القراءة.'
                            : 'Shown behind the login & signup form. A subtle dark overlay is added for readability.'}
                    </p>
                    {login && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{login.name}</p>}
                    {loginUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={loginUrl} alt='' className='mt-2 h-28 w-full rounded-lg object-cover' />
                    )}
                </div>

                {/* Live preview — updates as you type name / pick colours / upload images */}
                <p className='mb-2 mt-4 text-sm text-gray-500'>
                    {isAr ? 'معاينة مباشرة لمنصتك:' : 'Live preview of your platform:'}
                </p>
                <HomePreview name={nameWatch} palette={palette} logoUrl={logoUrl} heroUrl={heroUrl} aboutUrl={aboutUrl} faviconUrl={faviconUrl} galleryUrls={galleryUrls} aboutBullets={aboutBullets} isAr={isAr} />
            </div>

            {/* ══ 4. Contact — phone, WhatsApp, social (optional) ══ */}
            <p className='mb-4 mt-8 text-xs font-bold uppercase tracking-wide text-[#1E7D67]'>
                {isAr ? '٤ · وسائل التواصل' : '4 · Contact'}
            </p>

            {/* Contact details — fill the front-page contact section */}
            <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div>
                    <label htmlFor='contactPhone' className='mb-1.5 block font-bold text-[#0B2923]'>
                        {isAr ? 'رقم التواصل' : 'Contact phone'}{' '}
                        <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='contactPhone'
                        type='tel'
                        dir='ltr'
                        placeholder='+20 100 000 0000'
                        className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white ${isAr ? 'text-right' : ''}`}
                        {...register('contactPhone')}
                    />
                </div>
                <div>
                    <label htmlFor='contactWhatsapp' className='mb-1.5 block font-bold text-[#0B2923]'>
                        {isAr ? 'واتساب' : 'WhatsApp'}{' '}
                        <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <input
                        id='contactWhatsapp'
                        type='tel'
                        dir='ltr'
                        placeholder={isAr ? 'فارغ = نفس رقم التواصل' : 'blank = same as phone'}
                        className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition-colors focus:border-[#1E7D67] focus:bg-white ${isAr ? 'text-right' : ''}`}
                        {...register('contactWhatsapp')}
                    />
                </div>
            </div>

            {/* Social links — only the ones filled show on the site (as icons, new tab) */}
            <div className='mb-6'>
                <label className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'روابط التواصل الاجتماعي' : 'Social links'}{' '}
                    <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                </label>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    {([['socialFacebook', 'Facebook'], ['socialInstagram', 'Instagram'], ['socialYoutube', 'YouTube'], ['socialTiktok', 'TikTok'], ['socialWebsite', isAr ? 'الموقع' : 'Website']] as const).map(([field, label]) => (
                        <input
                            key={field}
                            type='url'
                            dir='ltr'
                            placeholder={`${label} URL`}
                            className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                            {...register(field)}
                        />
                    ))}
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
