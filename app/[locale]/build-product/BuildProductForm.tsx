'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/navigation'
import HomePreview, { DEFAULT_PALETTE, type Palette } from './HomePreview'
import { useMe } from '../components/useMe'

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
type License = { key: string; name: string; price: number; priceEgp?: number; priceEgpMonthly?: number; durationDays?: number; active: boolean; contactSales?: boolean; maxCourses: number; maxTeachers?: number; storageGb?: number; videoSource?: string; supportedApp?: boolean; features: Record<string, boolean>; limits?: Record<string, number> }
const FEATURE_LABELS: Record<string, string> = { drm: 'DRM video', coupons: 'coupons', offers: 'offers', subscriptions: 'subscriptions', packages: 'packages', jitsi: 'live sessions' }
const ALL_FEATURES = ['drm', 'coupons', 'offers', 'subscriptions', 'packages', 'jitsi'] as const
const BUCKET_KEYS: { key: string; ar: string; en: string }[] = [
    { key: 'quiz', ar: 'اختبارات/كورس', en: 'Quizzes/course' },
    { key: 'video', ar: 'فيديوهات/كورس', en: 'Videos/course' },
    { key: 'pdf', ar: 'ملفات PDF/كورس', en: 'PDFs/course' },
]

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
    linkTerms: string
    linkPrivacy: string
    _hp?: string // honeypot — stays empty for humans
}

type SuccessInfo = { slug: string; branch: string }

// Client-side upload caps — keep the JSON body small enough for the proxy in
// front of the site (see nginx client_max_body_size) and match the server's own
// per-image limit in provision-server.py.
const LOGO_MAX = 1.5 * 1024 * 1024
const FAVICON_MAX = 512 * 1024
// Homepage templates (theme_nit blocks/templates/tN). NIT picks the look; the
// owner applies images + brand colour afterwards. Keep in sync with
// theme/nit/classes/local/homepage_templates.php.
const HOMEPAGE_TEMPLATES: { id: string; en: string; ar: string }[] = [
    { id: 't1', en: 'Modern Minimal', ar: 'بسيط عصري' },
    { id: 't2', en: 'Bold Gradient', ar: 'تدرّج جريء' },
    { id: 't3', en: 'Academic Classic', ar: 'أكاديمي كلاسيكي' },
    { id: 't4', en: 'Dark Premium', ar: 'داكن فاخر' },
    { id: 't5', en: 'Warm Editorial', ar: 'تحريري دافئ' },
    { id: 't6', en: 'Soft Glass', ar: 'زجاج ناعم' },
    { id: 't7', en: 'Corporate Trust', ar: 'ثقة مؤسسية' },
    { id: 't8', en: 'Playful Rounded', ar: 'مرِح مستدير' },
    { id: 't9', en: 'Elegant Mono', ar: 'أحادي أنيق' },
    { id: 't10', en: 'Vibrant Duotone', ar: 'ثنائي نابض' },
]

// Homepage template content the owner can fill at creation. Text hooks in the
// template blocks (data-nit-edit). `bi` = bilingual (EN+AR); otherwise a single
// value. Long-tail fields (testimonials, FAQ, gallery captions) are edited in
// Moodle afterwards. Keep keys in sync with theme_nit homepage_content::fields().
const CONTENT_FIELDS: { key: string; en: string; ar: string; bi?: boolean; ml?: boolean; link?: boolean }[] = [
    { key: 'hero_title', en: 'Hero title', ar: 'عنوان البطل', bi: true, ml: true },
    { key: 'hero_subtitle', en: 'Hero subtitle', ar: 'وصف البطل', bi: true, ml: true },
    { key: 'about_heading', en: 'About heading', ar: 'عنوان من نحن', bi: true },
    { key: 'about_text', en: 'About text', ar: 'نص من نحن', bi: true, ml: true },
    { key: 'footer_tagline', en: 'Footer tagline', ar: 'سطر التذييل', bi: true },
    { key: 'contact_email', en: 'Contact email', ar: 'بريد التواصل' },
    { key: 'contact_phone', en: 'Contact phone', ar: 'هاتف التواصل' },
    { key: 'contact_address', en: 'Contact address', ar: 'العنوان', bi: true },
    { key: 'app_ios', en: 'App Store URL', ar: 'رابط آب ستور', link: true },
    { key: 'app_android', en: 'Google Play URL', ar: 'رابط جوجل بلاي', link: true },
]
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

const BuildProductForm = ({ onSuccess, editSlug }: { onSuccess?: () => void; editSlug?: string } = {}) => {
    const t = useTranslations('BuildProduct')
    const locale = useLocale()
    const isAr = locale === 'ar'
    // Re-apply-branding mode: the academy already exists; we only push updated
    // branding (no slug / licence / create). Set via the `editSlug` prop.
    const isEdit = !!editSlug

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        defaultValues: { name: '', fullnameEn: '', shortnameAr: '', shortnameEn: '', slug: '', tier: 'demo', contactPhone: '', contactWhatsapp: '', socialFacebook: '', socialInstagram: '', socialYoutube: '', socialTiktok: '', socialWebsite: '', linkTerms: '', linkPrivacy: '', _hp: '' },
    })

    const [done, setDone] = useState<SuccessInfo | null>(null)
    const [licenses, setLicenses] = useState<License[]>([])
    // Editable-image size cap (bytes), from the platform setting max_image_mb.
    const [imgMax, setImgMax] = useState(LOGO_MAX)
    const imgMaxLabel = `${(imgMax / 1_048_576).toFixed(1)} MB`
    const [logo, setLogo] = useState<File | null>(null)
    const [logocompact, setLogocompact] = useState<File | null>(null)
    const [favicon, setFavicon] = useState<File | null>(null)
    const [platformLang, setPlatformLang] = useState<'ar' | 'en' | 'both'>('both') // academy language
    const [homepageTemplate, setHomepageTemplate] = useState('t1') // homepage template (t1..t10)
    const [content, setContent] = useState<Record<string, string>>({}) // homepage template content (keyed by field key, or key_en/key_ar for bilingual)
    const setC = (k: string, v: string) => setContent((c) => ({ ...c, [k]: v }))
    const [autoRenewEnabled, setAutoRenewEnabled] = useState(false) // is the auto-renew feature on (server flag)
    const [autoRenew, setAutoRenew] = useState(true) // buyer's choice (paid tier, create mode)
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual') // paid-tier billing cycle
    const [changingPlan, setChangingPlan] = useState(false) // show all plans vs just the picked one

    // Admin mode — an admin creating an academy FOR a user (same page, extra items):
    // pick an owner (or a new one), any tier (incl. contact-sales), provisioned free.
    const me = useMe()
    const isAdmin = me?.role === 'admin'
    type AdminUser = { id: string; name: string | null; email: string }
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
    const [ownerSel, setOwnerSel] = useState('') // '' = none, '__new__', or a user id
    const [newOwner, setNewOwner] = useState({ email: '', name: '', password: '' })
    const [adminPwd, setAdminPwd] = useState<{ email: string; password: string } | null>(null)
    useEffect(() => {
        if (!isAdmin) return
        fetch('/api/users', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => setAdminUsers(d.users ?? []))
            .catch(() => { })
    }, [isAdmin])
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
    // About points. When the academy is bilingual each entry is an {mlang}-tagged
    // string ({mlang en}…{mlang}{mlang ar}…{mlang}); the academy's multilang2
    // filter renders the viewer's language. Single-language academies store plain
    // text. Same model the site name uses — no backend change needed.
    const [aboutBullets, setAboutBullets] = useState<string[]>([])
    const [bulletEn, setBulletEn] = useState('')
    const [bulletAr, setBulletAr] = useState('')
    // About subheader (the <h3> under "About") — same EN/AR → {mlang} model.
    const [subheaderEn, setSubheaderEn] = useState('')
    const [subheaderAr, setSubheaderAr] = useState('')
    const makeBullet = (en: string, ar: string) => {
        const e = en.trim(), a = ar.trim()
        if (e && a) return `{mlang en}${e}{mlang}{mlang ar}${a}{mlang}`
        return e || a // one side only → plain text
    }
    const bulletMatch = (s: string, lang: 'en' | 'ar') =>
        s.match(new RegExp(`\\{mlang ${lang}\\}([\\s\\S]*?)\\{mlang\\}`, 'i'))?.[1]
    // Readable chip label: show the available language text(s), tags stripped.
    const bulletLabel = (s: string) => {
        const en = bulletMatch(s, 'en'), ar = bulletMatch(s, 'ar')
        return (en || ar) ? [en, ar].filter(Boolean).join('  ·  ') : s
    }
    // One language for the live preview.
    const bulletPreview = (s: string) => {
        const en = bulletMatch(s, 'en'), ar = bulletMatch(s, 'ar')
        return (en || ar) ? ((isAr ? ar : en) || en || ar || '') : s
    }
    const addBullet = () => {
        const v = (hasAr && hasEn) ? makeBullet(bulletEn, bulletAr) : bulletEn.trim()
        if (v && aboutBullets.length < 8 && !aboutBullets.includes(v)) setAboutBullets((a) => [...a, v])
        setBulletEn(''); setBulletAr('')
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
                // Default to a BUYABLE plan — never a "contact sales" one.
                const buyable = active.filter((l) => !l.contactSales)
                if (buyable.length && !buyable.some((l) => l.key === watch('tier'))) {
                    setValue('tier', buyable[0].key)
                }
                // Honor a plan pre-selected from the pricing page. Query params win;
                // otherwise fall back to localStorage (survives the sign-in redirect,
                // which drops the query). Consumed once.
                try {
                    const q = new URLSearchParams(window.location.search)
                    let qt = q.get('tier'); let qc = q.get('cycle')
                    if (!qt) {
                        const saved = JSON.parse(localStorage.getItem('nit_selected_plan') || 'null')
                        if (saved) { qt = saved.tier; qc = saved.cycle }
                    }
                    localStorage.removeItem('nit_selected_plan')
                    if (qt && buyable.some((l) => l.key === qt)) setValue('tier', qt)
                    if (qc === 'monthly' || qc === 'annual') setBillingCycle(qc)
                } catch { /* no selection */ }
            })
            .catch(() => { })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Load the configurable image-size cap (falls back to the compiled default).
    useEffect(() => {
        fetch('/api/public-settings')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                const mb = Number(d?.maxImageMb)
                if (Number.isFinite(mb) && mb > 0) setImgMax(mb * 1_048_576)
                setAutoRenewEnabled(!!d?.autoRenewEnabled)
            })
            .catch(() => { })
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
            const links: Record<string, string> = {}
            if (values.linkTerms?.trim()) links.terms = values.linkTerms.trim()
            if (values.linkPrivacy?.trim()) links.privacy = values.linkPrivacy.trim()
            if (Object.keys(links).length) brand.links = links
            if (aboutBullets.length) brand.about_bullets = aboutBullets
            const subheader = (hasAr && hasEn) ? makeBullet(subheaderEn, subheaderAr) : subheaderEn.trim()
            if (subheader) brand.about_subheader = subheader

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

            // Homepage template content (text + links). Images (logo/hero/about/
            // gallery) already ride in `brand`; the provisioning content step reuses
            // them. Bilingual fields become {en,ar}. Empty fields are omitted so the
            // template keeps its designed defaults.
            const contentText: Record<string, unknown> = {}
            const contentHref: Record<string, string> = {}
            for (const f of CONTENT_FIELDS) {
                if (f.link) {
                    const v = (content[f.key] || '').trim()
                    if (v) contentHref[f.key] = v
                } else if (f.bi) {
                    const en = (content[`${f.key}_en`] || '').trim()
                    const ar = (content[`${f.key}_ar`] || '').trim()
                    if (en || ar) contentText[f.key] = { en, ar }
                } else {
                    const v = (content[f.key] || '').trim()
                    if (v) contentText[f.key] = v
                }
            }
            const contentPayload = (Object.keys(contentText).length || Object.keys(contentHref).length)
                ? { text: contentText, href: contentHref }
                : undefined

            // Paid tier (create mode only) → start Kashier checkout instead of
            // provisioning now. On success the client is redirected to Kashier's
            // hosted page; the academy is provisioned by the webhook after payment.
            // Admin creating for a user → provision free via /api/academies (skip
            // Kashier), on any tier. Owner fields go with the create body below.
            const adminOwner: Record<string, string> =
                (isAdmin && ownerSel)
                    ? (ownerSel === '__new__'
                        ? { ownerEmail: newOwner.email.trim().toLowerCase(), ownerName: newOwner.name.trim(), ownerPassword: newOwner.password }
                        : { ownerId: ownerSel })
                    : {}
            if (isAdmin && ownerSel === '__new__' && (!newOwner.email.trim() || newOwner.name.trim().length < 2)) {
                toast.error(isAr ? 'اكتب بريد واسم المالك الجديد.' : 'Enter the new owner’s email and name.')
                return
            }

            if (!isEdit && !(isAdmin && ownerSel)) {
                const selected = licenses.find((l) => l.key === values.tier)
                if (selected && (selected.priceEgp ?? 0) > 0) {
                    // Use the monthly cycle only if the tier actually has a monthly price.
                    const effCycle = billingCycle === 'monthly' && (selected.priceEgpMonthly ?? 0) > 0 ? 'monthly' : 'annual'
                    const pr = await fetch('/api/payments/kashier/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: values.name,
                            slug: values.slug.toLowerCase().trim(),
                            tier: values.tier,
                            cycle: effCycle,
                            brand,
                            locale,
                            platform_lang: platformLang,
                            homepageTemplate,
                            content: contentPayload,
                            purpose: 'new_academy',
                            autoRenew: autoRenewEnabled ? autoRenew : false,
                        }),
                    })
                    const pd = await pr.json()
                    if (!pr.ok || !pd?.url) {
                        toast.error(pd?.error || t('errorGeneric'))
                        return
                    }
                    // Off to Kashier's hosted payment page.
                    window.location.href = pd.url
                    return
                }
            }

            // Re-apply-branding mode → push the brand to the existing academy;
            // create mode (free tier) → provision a new one.
            const res = isEdit
                ? await fetch(`/api/academies/${editSlug}/branding`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ brand, platform_lang: platformLang }),
                })
                : await fetch('/api/academies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: values.name,
                        slug: values.slug.toLowerCase().trim(),
                        tier: values.tier,
                        brand,
                        locale,
                        platform_lang: platformLang,
                        homepageTemplate,
                        content: contentPayload,
                        _hp: values._hp,
                        ...adminOwner,
                    }),
                })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data?.error || t('errorGeneric'))
                return
            }
            // Admin created a NEW owner inline → show its one-time password.
            if (data?.ownerPassword) setAdminPwd({ email: data.ownerEmail, password: data.ownerPassword })
            toast.success(isEdit ? (isAr ? 'يتم تحديث الهوية…' : 'Applying branding…') : t('successToast'))
            // Edit mode: the modal (if any) handles closing; on the standalone edit
            // page there's no callback, so return the owner to their account.
            if (isEdit) {
                if (onSuccess) onSuccess()
                else setTimeout(() => { window.location.href = `/${locale}/account` }, 800)
                return
            }
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
            className='grid w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]'
            noValidate
        >
            {/* Left column — the form fields (the card). */}
            <div className='min-w-0 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-8'>

            {/* ══ Admin: create FOR a user (extra items, admins only) ══ */}
            {isAdmin && !isEdit && (
                <div className='mb-6 rounded-xl border border-[#268F79]/40 bg-[#268F79]/[0.04] p-4'>
                    <p className='mb-2 text-xs font-bold uppercase tracking-wide text-[#268F79]'>
                        {isAr ? 'وضع الأدمن — إنشاء لمالك' : 'Admin — create for a user'}
                    </p>
                    <label className='mb-1 block text-sm font-semibold text-[#0B2923]'>{isAr ? 'المالك' : 'Owner'}</label>
                    <select value={ownerSel} onChange={(e) => setOwnerSel(e.target.value)}
                        className='w-full rounded-lg border px-3 py-2'>
                        <option value=''>{isAr ? '— أنا (إنشاء عادي/مدفوع) —' : '— Myself (normal/paid flow) —'}</option>
                        <option value='__new__'>{isAr ? '➕ مالك جديد…' : '➕ New user…'}</option>
                        {adminUsers.map((u) => (
                            <option key={u.id} value={u.id}>{(u.name || '—')} · {u.email}</option>
                        ))}
                    </select>
                    {ownerSel === '__new__' && (
                        <div className='mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3'>
                            <input placeholder={isAr ? 'البريد' : 'Email'} value={newOwner.email}
                                onChange={(e) => setNewOwner((o) => ({ ...o, email: e.target.value }))} className='rounded-lg border px-3 py-2' />
                            <input placeholder={isAr ? 'الاسم' : 'Name'} value={newOwner.name}
                                onChange={(e) => setNewOwner((o) => ({ ...o, name: e.target.value }))} className='rounded-lg border px-3 py-2' />
                            <input placeholder={isAr ? 'كلمة السر (أو اتركها للتوليد)' : 'Password (blank = auto)'} value={newOwner.password}
                                onChange={(e) => setNewOwner((o) => ({ ...o, password: e.target.value }))} className='rounded-lg border px-3 py-2' />
                        </div>
                    )}
                    {ownerSel && (
                        <p className='mt-2 text-[11px] text-[#268F79]'>
                            {isAr ? 'سيتم الإنشاء لهذا المالك بدون دفع، على أي باقة تختارها (بما فيها الاحترافية).'
                                : 'Will provision for this owner with no payment, on any tier you pick (incl. Professional).'}
                        </p>
                    )}
                    {adminPwd && (
                        <div className='mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs'>
                            <p className='font-semibold text-emerald-800'>{isAr ? 'تم إنشاء مستخدم جديد — بيانات الدخول (تظهر مرة واحدة):' : 'New user created — credentials (shown once):'}</p>
                            <p className='mt-1 font-mono'>{isAr ? 'البريد' : 'Email'}: {adminPwd.email}</p>
                            <p className='font-mono'>{isAr ? 'كلمة السر' : 'Password'}: {adminPwd.password}</p>
                        </div>
                    )}
                </div>
            )}

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

            {/* Homepage template — the look of the academy's landing page (NIT picks; owner adds images/brand after) */}
            <div className='mb-5'>
                <label htmlFor='homepageTemplate' className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'قالب الصفحة الرئيسية' : 'Homepage template'}
                </label>
                <select
                    id='homepageTemplate'
                    value={homepageTemplate}
                    onChange={(e) => setHomepageTemplate(e.target.value)}
                    className='w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 transition focus:border-[#1E7D67] focus:ring-1 focus:ring-[#1E7D67]'
                >
                    {HOMEPAGE_TEMPLATES.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                            {tpl.id.toUpperCase()} · {isAr ? tpl.ar : tpl.en}
                        </option>
                    ))}
                </select>
                <p className='mt-1 text-xs text-gray-400'>
                    {isAr
                        ? 'شكل الصفحة الرئيسية للأكاديمية. يضيف المالك صوره وألوان هويته لاحقاً.'
                        : "The academy homepage style. The owner adds their images and brand colour afterwards."}
                </p>
            </div>

            {/* Homepage content — fills the template's editable text (optional; the rest is editable in Moodle later) */}
            <details className='mb-5 rounded-xl border border-gray-200 bg-gray-50/60'>
                <summary className='cursor-pointer px-4 py-3 text-sm font-bold text-[#0B2923]'>
                    {isAr ? 'محتوى الصفحة الرئيسية (اختياري)' : 'Homepage content (optional)'}
                </summary>
                <div className='grid gap-3 px-4 pb-4'>
                    <p className='text-xs text-gray-400'>
                        {isAr
                            ? 'اترك أي حقل فارغاً ليبقى النص الافتراضي. الشعار وصورة البطل ومن نحن والمعرض تُرفع من قسم الهوية. باقي المحتوى يُحرَّر داخل Moodle لاحقاً.'
                            : 'Leave a field blank to keep the default. Logo, hero, about and gallery images upload in the identity section. The rest is editable in Moodle later.'}
                    </p>
                    {CONTENT_FIELDS.map((f) => (
                        <div key={f.key}>
                            <label className='mb-1 block text-xs font-semibold text-[#0B2923]'>{isAr ? f.ar : f.en}</label>
                            {f.link ? (
                                <input
                                    type='url' inputMode='url' placeholder='https://…'
                                    value={content[f.key] || ''}
                                    onChange={(e) => setC(f.key, e.target.value)}
                                    className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'
                                />
                            ) : f.bi ? (
                                <div className='grid grid-cols-2 gap-2'>
                                    {(['en', 'ar'] as const).map((l) => (
                                        f.ml ? (
                                            <textarea key={l} rows={2} dir={l === 'ar' ? 'rtl' : 'ltr'}
                                                placeholder={l === 'ar' ? 'العربية' : 'English'}
                                                value={content[`${f.key}_${l}`] || ''}
                                                onChange={(e) => setC(`${f.key}_${l}`, e.target.value)}
                                                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm' />
                                        ) : (
                                            <input key={l} type='text' dir={l === 'ar' ? 'rtl' : 'ltr'}
                                                placeholder={l === 'ar' ? 'العربية' : 'English'}
                                                value={content[`${f.key}_${l}`] || ''}
                                                onChange={(e) => setC(`${f.key}_${l}`, e.target.value)}
                                                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm' />
                                        )
                                    ))}
                                </div>
                            ) : (
                                <input
                                    type='text'
                                    value={content[f.key] || ''}
                                    onChange={(e) => setC(f.key, e.target.value)}
                                    className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'
                                />
                            )}
                        </div>
                    ))}
                </div>
            </details>

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

            {!isEdit && (<>
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

                {/* Monthly / Annual billing-cycle toggle (applies to paid tiers). */}
                {licenses.some((l) => (l.priceEgpMonthly ?? 0) > 0) && (
                    <div className='mb-3 inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-sm'>
                        {(['monthly', 'annual'] as const).map((c) => (
                            <button
                                type='button'
                                key={c}
                                onClick={() => setBillingCycle(c)}
                                className={`rounded-full px-4 py-1.5 font-bold transition-colors ${billingCycle === c ? 'bg-[#1E7D67] text-white' : 'text-gray-600 hover:text-[#0B2923]'}`}
                            >
                                {c === 'monthly' ? (isAr ? 'شهري' : 'Monthly') : (isAr ? 'سنوي' : 'Annual')}
                                {c === 'annual' && (
                                    <span className={`ms-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-[#00c98e]/20 text-[#0b8f66]'}`}>
                                        {isAr ? 'شهران مجانًا' : '2 months free'}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {(() => {
                    // Once a plan is picked, collapse to just that plan (full details) with a
                    // "Change plan" button; expanded = compare all plans.
                    const showAll = !selectedTier || changingPlan
                    const visible = showAll ? licenses : licenses.filter((l) => l.key === selectedTier)
                    const cap = (n?: number) => ((n ?? -1) < 0 ? (isAr ? '∞' : '∞') : String(n))
                    const capB = (lic: License, k: string) => cap(lic.limits?.[k])
                    return (
                        <div className={`grid gap-2 ${showAll ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                            {visible.map((lic) => {
                                const on = selectedTier === lic.key
                                const paid = (lic.priceEgp ?? 0) > 0
                                const hasMonthly = (lic.priceEgpMonthly ?? 0) > 0
                                const useMonthly = paid && billingCycle === 'monthly' && hasMonthly
                                const price = useMonthly ? (lic.priceEgpMonthly ?? 0) : (lic.priceEgp ?? 0)
                                const per = useMonthly ? (isAr ? '/شهر' : '/mo') : (isAr ? '/سنة' : '/yr')
                                const contact = !!lic.contactSales
                                const detailed = !showAll // the collapsed single card gets the full spec
                                return (
                                    <button
                                        type='button'
                                        key={lic.key}
                                        onClick={() => (contact && !isAdmin)
                                            ? window.open(`/${locale}/contact?plan=${lic.key}`, '_blank')
                                            : (setValue('tier', lic.key), setChangingPlan(false))}
                                        className={`text-start rounded-xl border p-3 transition-colors ${contact ? 'border-[#0B2923]/20 bg-[#0B2923]/[0.03] hover:border-[#0B2923]/40' : on ? 'border-[#1E7D67] bg-[#1E7D67]/5 ring-1 ring-[#1E7D67]' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                                    >
                                        <div className='flex items-baseline justify-between gap-2'>
                                            <span className='font-bold text-[#0B2923]'>{lic.name}</span>
                                            <span className='text-sm font-bold text-[#1E7D67]' dir='ltr'>
                                                {contact ? (
                                                    <span className='rounded-full bg-[#0B2923]/10 px-2 py-0.5 text-[11px] font-bold text-[#0B2923]'>
                                                        {isAr ? 'تواصل معنا' : 'Contact us'}
                                                    </span>
                                                ) : paid ? (
                                                    <>{price} {isAr ? 'ج.م' : 'EGP'}<span className='text-[10px] font-normal text-gray-400'> {per}</span></>
                                                ) : (isAr ? 'مجاني' : 'Free')}
                                            </span>
                                        </div>
                                        {!contact && paid && billingCycle === 'monthly' && !hasMonthly && (
                                            <p className='text-[10px] text-gray-400'>{isAr ? 'سنوي فقط' : 'annual only'}</p>
                                        )}
                                        {contact && (
                                            <p className='text-[10px] font-semibold text-[#0B2923]/50'>{isAr ? 'باقة مخصّصة — تواصل مع المبيعات' : 'Custom plan — talk to sales'}</p>
                                        )}
                                        {/* Resources */}
                                        <div className='mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-gray-500'>
                                            <div>{isAr ? 'الكورسات:' : 'Courses:'} <b className='text-gray-700'>{cap(lic.maxCourses)}</b>{' · '}{isAr ? 'المدرّسون:' : 'Teachers:'} <b className='text-gray-700'>{cap(lic.maxTeachers)}</b></div>
                                            <div>{isAr ? 'التخزين:' : 'Storage:'} <b className='text-gray-700'>{lic.storageGb ?? 1} GB</b>{lic.videoSource ? <>{' · '}{isAr ? 'الفيديو:' : 'Video:'} <b className='text-gray-700'>{lic.videoSource}</b></> : null}</div>
                                            {detailed && (
                                                <>
                                                    <div>{BUCKET_KEYS.map((b) => `${isAr ? b.ar : b.en}: ${capB(lic, b.key)}`).join('  ·  ')}</div>
                                                    <div>{isAr ? 'تطبيق الموبايل:' : 'Mobile app:'} <b className='text-gray-700'>{lic.supportedApp === false ? (isAr ? 'لا' : 'No') : (isAr ? 'نعم' : 'Yes')}</b></div>
                                                    <div className='pt-1'>
                                                        {ALL_FEATURES.map((f) => (
                                                            <span key={f} className={`me-2 inline-block ${lic.features?.[f] ? 'text-[#1E7D67]' : 'text-gray-300 line-through'}`}>
                                                                {lic.features?.[f] ? '✓' : '✗'} {FEATURE_LABELS[f] ?? f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )
                })()}

                {selectedTier && !changingPlan && (
                    <button type='button' onClick={() => setChangingPlan(true)}
                        className='mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#1E7D67] hover:underline'>
                        <FiRefreshCw /> {isAr ? 'تغيير الباقة' : 'Change plan'}
                    </button>
                )}
            </div>
            <input type='hidden' {...register('tier')} />

            {/* Auto-renew opt-in — only in create mode, for a paid tier, when the
                feature is enabled server-side. Saves the card + renews automatically. */}
            {!isEdit && autoRenewEnabled && (() => {
                const lic = licenses.find((l) => l.key === selectedTier)
                if (!lic || (lic.priceEgp ?? 0) <= 0) return null
                const useMonthly = billingCycle === 'monthly' && (lic.priceEgpMonthly ?? 0) > 0
                const every = useMonthly ? (isAr ? 'شهريًا' : 'monthly') : (isAr ? 'سنويًا' : 'yearly')
                const price = useMonthly ? (lic.priceEgpMonthly ?? 0) : (lic.priceEgp ?? 0)
                return (
                    <label className='mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#1E7D67]/30 bg-[#1E7D67]/5 p-3'>
                        <input
                            type='checkbox'
                            checked={autoRenew}
                            onChange={(e) => setAutoRenew(e.target.checked)}
                            className='mt-0.5 h-5 w-5 accent-[#1E7D67]'
                        />
                        <span className='text-sm'>
                            <span className='font-bold text-[#0B2923]'>
                                {isAr ? 'تجديد تلقائي' : 'Auto-renew'}
                            </span>
                            <span className='block text-gray-600'>
                                {isAr
                                    ? `احفظ بطاقتي وجدّد الاشتراك ${every} تلقائيًا (${price} ج.م) حتى ألغيه. يمكنك الإلغاء في أي وقت من "منصاتي".`
                                    : `Save my card and renew ${every} automatically (${price} EGP) until I cancel. You can cancel anytime from "My platforms".`}
                            </span>
                        </span>
                    </label>
                )
            })()}
            </>)}

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
                            onChange={pickImage(setLogo, imgMax, LOGO_TYPES, imgMaxLabel)}
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
                            onChange={pickImage(setLogocompact, imgMax, LOGO_TYPES, imgMaxLabel)}
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
                        onChange={pickImage(setHero, imgMax, ['image/png', 'image/jpeg', 'image/webp'], imgMaxLabel)}
                        className='block w-full cursor-pointer rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-[#1E7D67]/10 file:px-4 file:py-2.5 file:font-semibold file:text-[#1E7D67] hover:file:bg-[#1E7D67]/15'
                    />
                    {hero && <p className='mt-1 truncate text-xs text-[#1E7D67]' dir='ltr'>{hero.name}</p>}
                </div>

                {/* About subheader (the <h3> under "About") */}
                <div className='mt-4'>
                    <label className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                        {isAr ? 'العنوان الفرعي للنبذة' : 'About subheader'}{' '}
                        <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <div className='flex gap-2'>
                        {hasEn && (
                            <input
                                type='text'
                                value={subheaderEn}
                                onChange={(e) => setSubheaderEn(e.target.value)}
                                placeholder={hasAr ? 'English subheader' : (isAr ? 'العنوان الفرعي' : 'Subheader')}
                                className='flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                            />
                        )}
                        {hasAr && (
                            <input
                                type='text'
                                dir='rtl'
                                value={subheaderAr}
                                onChange={(e) => setSubheaderAr(e.target.value)}
                                placeholder={hasEn ? 'العنوان الفرعي بالعربية' : 'العنوان الفرعي'}
                                className='flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                            />
                        )}
                    </div>
                </div>

                {/* About bullet points (chips) */}
                <div className='mt-4'>
                    <label className='mb-1.5 block text-sm font-semibold text-[#0B2923]'>
                        {isAr ? 'نقاط النبذة (About)' : 'About points'}{' '}
                        <span className='text-xs font-normal text-gray-400'>({t('optional')})</span>
                    </label>
                    <div className='flex gap-2'>
                        {hasEn && (
                            <input
                                type='text'
                                value={bulletEn}
                                onChange={(e) => setBulletEn(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBullet() } }}
                                placeholder={hasAr ? 'English point' : (isAr ? 'اكتب نقطة ثم أضف' : 'Type a point, then Add')}
                                className='flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                            />
                        )}
                        {hasAr && (
                            <input
                                type='text'
                                dir='rtl'
                                value={bulletAr}
                                onChange={(e) => setBulletAr(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBullet() } }}
                                placeholder={hasEn ? 'النقطة بالعربية' : 'اكتب نقطة ثم أضف'}
                                className='flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                            />
                        )}
                        <button type='button' onClick={addBullet} className='shrink-0 rounded-xl bg-[#1E7D67]/10 px-4 py-2.5 text-sm font-semibold text-[#1E7D67] hover:bg-[#1E7D67]/15'>
                            {isAr ? 'أضف' : 'Add'}
                        </button>
                    </div>
                    {hasAr && hasEn && (
                        <p className='mt-1 text-xs text-gray-400'>
                            {isAr ? 'أدخل النقطة بالإنجليزية والعربية — تظهر كل لغة حسب لغة المستخدم.' : 'Enter each point in English and Arabic — each shows in the viewer’s language.'}
                        </p>
                    )}
                    {aboutBullets.length > 0 && (
                        <div className='mt-2 flex flex-wrap gap-2'>
                            {aboutBullets.map((b, i) => (
                                <span key={i} className='inline-flex items-center gap-1.5 rounded-full bg-[#1E7D67]/10 px-3 py-1 text-xs text-[#0B2923]'>
                                    {bulletLabel(b)}
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
                            onChange={pickImage(setAbout, imgMax, ['image/png', 'image/jpeg', 'image/webp'], imgMaxLabel)}
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
                                const ok = files.filter((f) => f.size <= imgMax && ['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
                                if (ok.length < files.length) toast.error(t('imageTooLarge', { max: imgMaxLabel }))
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
                        onChange={pickImage(setLogin, imgMax, ['image/png', 'image/jpeg', 'image/webp'], imgMaxLabel)}
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

            {/* Legal links — per-academy override of the platform default (app only) */}
            <div className='mb-6'>
                <label className='mb-1.5 block font-bold text-[#0B2923]'>
                    {isAr ? 'روابط قانونية (اختياري)' : 'Legal links'}{' '}
                    <span className='text-sm font-normal text-gray-400'>({t('optional')})</span>
                </label>
                <p className='mb-2 text-xs text-gray-500'>
                    {isAr
                        ? 'روابط الشروط والخصوصية التي تظهر في التطبيق. اتركها فارغة لاستخدام الافتراضي العام.'
                        : 'Terms & Privacy URLs shown in the app. Leave blank to use the platform default.'}
                </p>
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <input type='url' dir='ltr' placeholder={isAr ? 'رابط الشروط' : 'Terms URL'}
                        className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                        {...register('linkTerms')} />
                    <input type='url' dir='ltr' placeholder={isAr ? 'رابط الخصوصية' : 'Privacy URL'}
                        className='w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
                        {...register('linkPrivacy')} />
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
                {isSubmitting
                    ? t('submitting')
                    : isEdit ? (isAr ? 'حفظ وتحديث الهوية' : 'Save & apply branding') : t('submit')}
            </button>
            </div>{/* end left column */}

            {/* Right column — sticky live preview beside the form. */}
            <aside className='lg:sticky lg:top-6 h-fit rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5'>
                <p className='mb-2 text-sm font-bold text-[#0B2923]'>
                    {isAr ? 'معاينة مباشرة لمنصتك' : 'Live preview of your platform'}
                </p>
                <HomePreview name={nameWatch} palette={palette} logoUrl={logoUrl} heroUrl={heroUrl} aboutUrl={aboutUrl} faviconUrl={faviconUrl} galleryUrls={galleryUrls} aboutBullets={aboutBullets.map(bulletPreview)} isAr={isAr} />
            </aside>
        </form>
    )
}

export default BuildProductForm
