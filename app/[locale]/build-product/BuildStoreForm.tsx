'use client'

// Store (commerce) creation form — the store counterpart of BuildProductForm.
// Much smaller on purpose: a store's look is edited inside its own dashboard
// after creation; here we only collect what the provisioner needs on day one
// (identity, market, brand colours + logo, contact, plan) and route the request:
//   paid tier            → POST /api/payments/kashier/create {product:"store"} → Kashier
//   free tier / admin comp → POST /api/stores
import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useLocale } from 'next-intl'
import { Link } from '@/navigation'
import { useMe } from '../components/useMe'

type StoreLicense = {
    key: string; name: string; price: number; priceEgp?: number; priceEgpMonthly?: number; durationDays?: number
    active: boolean; contactSales?: boolean; limits?: Record<string, number>; features?: Record<string, boolean>
}
type AdminUser = { id: string; name: string | null; email: string }

type FormValues = {
    name: string        // Arabic name (primary)
    nameEn: string      // English name (SEO title)
    slug: string
    tier: string
    contactPhone: string
    contactWhatsapp: string
    contactEmail: string
    socialInstagram: string
    socialFacebook: string
    socialTiktok: string
    _hp?: string        // honeypot
}

// Market presets: country → currency + VAT (the store keeps these editable later).
const MARKETS: { code: string; ar: string; en: string; currency: string; vat: number; tz: string }[] = [
    { code: 'EG', ar: 'مصر', en: 'Egypt', currency: 'EGP', vat: 14, tz: 'Africa/Cairo' },
    { code: 'SA', ar: 'السعودية', en: 'Saudi Arabia', currency: 'SAR', vat: 15, tz: 'Asia/Riyadh' },
    { code: 'AE', ar: 'الإمارات', en: 'UAE', currency: 'AED', vat: 5, tz: 'Asia/Dubai' },
    { code: 'KW', ar: 'الكويت', en: 'Kuwait', currency: 'KWD', vat: 0, tz: 'Asia/Kuwait' },
    { code: 'QA', ar: 'قطر', en: 'Qatar', currency: 'QAR', vat: 0, tz: 'Asia/Qatar' },
    { code: 'OM', ar: 'عُمان', en: 'Oman', currency: 'OMR', vat: 5, tz: 'Asia/Muscat' },
    { code: 'BH', ar: 'البحرين', en: 'Bahrain', currency: 'BHD', vat: 10, tz: 'Asia/Bahrain' },
]
const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
const LOGO_MAX = 1.5 * 1024 * 1024
const STORE_FEATURES: Record<string, { ar: string; en: string }> = {
    coupons: { ar: 'كوبونات', en: 'Coupons' }, offers: { ar: 'العروض', en: 'Offers' }, banners: { ar: 'البانرات', en: 'Banners' },
    blog: { ar: 'المدونة', en: 'Blog' }, reviews: { ar: 'التقييمات', en: 'Reviews' }, reports: { ar: 'التقارير', en: 'Reports' },
    custom_domain: { ar: 'دومين خاص', en: 'Custom domain' },
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => { const s = String(r.result); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s) }
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
    })
}
const cap = (n: number | undefined, unlimited: string) => ((n ?? -1) < 0 ? unlimited : String(n))

export default function BuildStoreForm() {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const me = useMe()
    const isAdmin = me?.role === 'admin'

    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
        defaultValues: { tier: '', contactPhone: '', contactWhatsapp: '', contactEmail: '', socialInstagram: '', socialFacebook: '', socialTiktok: '' },
    })
    const [licenses, setLicenses] = useState<StoreLicense[]>([])
    const [market, setMarket] = useState(MARKETS[0])
    const [defaultLocale, setDefaultLocale] = useState<'ar' | 'en'>('ar')
    const [primary, setPrimary] = useState('#111111')
    const [accent, setAccent] = useState('#1fb6c7')
    const [logo, setLogo] = useState<File | null>(null)
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual')
    const [autoRenew, setAutoRenew] = useState(true)
    const [autoRenewEnabled, setAutoRenewEnabled] = useState(false)
    const [done, setDone] = useState<{ slug: string; url: string } | null>(null)
    // Admin: create FOR a user (comp — any tier, no payment).
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
    const [ownerSel, setOwnerSel] = useState('')
    const [newOwner, setNewOwner] = useState({ email: '', name: '', password: '' })
    const [adminPwd, setAdminPwd] = useState<{ email: string; password: string } | null>(null)

    const tierKey = watch('tier')
    const selected = useMemo(() => licenses.find((l) => l.key === tierKey), [licenses, tierKey])
    const paid = !!selected && (selected.priceEgp ?? 0) > 0
    const monthlyAvailable = !!selected && (selected.priceEgpMonthly ?? 0) > 0

    useEffect(() => {
        fetch('/api/licenses?product=store', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => {
                const active: StoreLicense[] = (d?.licenses ?? []).filter((l: StoreLicense) => l.active)
                setLicenses(active)
                // Pre-selected plan: ?tier=&cycle= (pricing page) or the localStorage copy
                // that survives the sign-in redirect; otherwise the cheapest plan.
                const qs = new URLSearchParams(window.location.search)
                let tier = qs.get('tier') || ''
                let cycle = qs.get('cycle') || ''
                if (!tier) {
                    try {
                        const saved = JSON.parse(localStorage.getItem('nit_selected_plan') || 'null')
                        if (saved?.product === 'store') { tier = saved.tier || ''; cycle = saved.cycle || '' }
                    } catch { /* ignore */ }
                    localStorage.removeItem('nit_selected_plan')
                }
                const pick = active.find((l) => l.key === tier) ?? [...active].sort((a, b) => (a.priceEgp ?? 0) - (b.priceEgp ?? 0))[0]
                if (pick) setValue('tier', pick.key)
                if (cycle === 'monthly') setBillingCycle('monthly')
            })
            .catch(() => toast.error(tr('تعذّر تحميل الباقات.', 'Could not load plans.')))
        fetch('/api/public-settings').then((r) => r.json()).then((d) => setAutoRenewEnabled(!!d?.autoRenewEnabled)).catch(() => {})
    }, [setValue]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isAdmin) return
        fetch('/api/users', { cache: 'no-store' }).then((r) => r.json())
            .then((d) => setAdminUsers((d?.users ?? []).filter((u: AdminUser & { role?: string }) => u.role !== 'admin')))
            .catch(() => {})
    }, [isAdmin])

    const onLogo = (f: File | null) => {
        if (!f) return setLogo(null)
        if (!LOGO_TYPES.includes(f.type)) return toast.error(tr('صيغة اللوجو غير مدعومة (PNG/SVG/JPG/WebP).', 'Unsupported logo type (PNG/SVG/JPG/WebP).'))
        if (f.size > LOGO_MAX) return toast.error(tr('اللوجو أكبر من 1.5 ميجا.', 'Logo is larger than 1.5 MB.'))
        setLogo(f)
    }

    const onSubmit = async (v: FormValues) => {
        try {
            const slug = v.slug.trim().toLowerCase()
            const store = {
                country: market.code, currency: market.currency, timezone: market.tz, vat_rate: market.vat, prices_include_vat: true,
                default_locale: defaultLocale,
                theme: { primary_color: primary, accent_color: accent, font: 'Tajawal' },
                contact: { phone: v.contactPhone.trim() || undefined, whatsapp: v.contactWhatsapp.trim() || undefined, email: v.contactEmail.trim() || undefined },
                social: { instagram: v.socialInstagram.trim() || undefined, facebook: v.socialFacebook.trim() || undefined, tiktok: v.socialTiktok.trim() || undefined },
                seo_title: v.nameEn.trim() || undefined, seo_title_ar: v.name.trim(),
                logo: logo ? { filename: logo.name, data_b64: await fileToBase64(logo) } : undefined,
            }
            const adminOwner: Record<string, string> = (isAdmin && ownerSel)
                ? (ownerSel === '__new__'
                    ? { ownerEmail: newOwner.email.trim().toLowerCase(), ownerName: newOwner.name.trim(), ownerPassword: newOwner.password }
                    : { ownerId: ownerSel })
                : {}
            if (isAdmin && ownerSel === '__new__' && (!newOwner.email.trim() || newOwner.name.trim().length < 2)) {
                toast.error(tr('اكتب بريد واسم المالك الجديد.', 'Enter the new owner’s email and name.'))
                return
            }

            // Paid plan (not an admin comp) → Kashier checkout; the webhook creates the store.
            if (paid && !(isAdmin && ownerSel)) {
                const effCycle = billingCycle === 'monthly' && monthlyAvailable ? 'monthly' : 'annual'
                const pr = await fetch('/api/payments/kashier/create', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product: 'store', name: v.name.trim(), name_ar: v.name.trim(), slug, tier: v.tier, cycle: effCycle, locale, store, autoRenew: autoRenewEnabled ? autoRenew : false }),
                })
                const pd = await pr.json()
                if (!pr.ok || !pd?.url) { toast.error(pd?.error || tr('حصل خطأ، حاول تاني.', 'Something went wrong, try again.')); return }
                window.location.href = pd.url
                return
            }

            const res = await fetch('/api/stores', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: v.name.trim(), name_ar: v.name.trim(), slug, tier: v.tier, locale, store, _hp: v._hp, ...adminOwner }),
            })
            const d = await res.json()
            if (!res.ok) { toast.error(d?.error || tr('حصل خطأ، حاول تاني.', 'Something went wrong, try again.')); return }
            if (d?.ownerPassword) setAdminPwd({ email: adminOwner.ownerEmail ?? '', password: d.ownerPassword })
            toast.success(tr('جاري تجهيز متجرك…', 'Your store is being prepared…'))
            setDone({ slug: d.slug, url: d.url })
        } catch (e) {
            console.error(e)
            toast.error(tr('حصل خطأ، حاول تاني.', 'Something went wrong, try again.'))
        }
    }

    const input = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[#0B2923] outline-none transition focus:border-[#1E7D67] focus:ring-2 focus:ring-[#1E7D67]/20'
    const label = 'mb-1 block text-sm font-bold text-[#0B2923]'

    if (done) {
        return (
            <div className='mx-auto w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-2xl ring-1 ring-black/5'>
                <div className='mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#00FFB2]/15 text-3xl'>🛒</div>
                <h3 className='text-2xl font-extrabold text-[#0B2923]'>{tr('طلبك اتسجّل — متجرك بيتجهّز', 'Your store is on its way')}</h3>
                <p className='mt-2 text-gray-600'>
                    {tr('بيستغرق التجهيز أقل من دقيقة. تابع الخطوات من حسابك، وهيوصلك إيميل ببيانات دخول لوحة التحكم.',
                        'Provisioning takes under a minute. Follow the steps from your account; an e-mail with your dashboard credentials is on its way.')}
                </p>
                <div className='mt-6 rounded-xl bg-[#0B2923]/[0.03] p-4 text-start ring-1 ring-black/5'>
                    <p className='text-sm text-gray-500'>{tr('رابط متجرك', 'Your store URL')}</p>
                    <p className='mt-1 font-mono text-sm font-bold text-[#1E7D67]' dir='ltr'>{done.url}</p>
                    <p className='mt-3 text-sm text-gray-500'>{tr('لوحة التحكم', 'Dashboard')}</p>
                    <p className='mt-1 font-mono text-sm text-[#0B2923]' dir='ltr'>{done.url}/dashboard</p>
                </div>
                {adminPwd && (
                    <div className='mt-4 rounded-xl bg-amber-50 p-4 text-start text-sm ring-1 ring-amber-200'>
                        <b>{tr('بيانات المالك الجديد (تظهر مرة واحدة):', 'New owner login (shown once):')}</b>
                        <div className='mt-1 font-mono' dir='ltr'>{adminPwd.email} / {adminPwd.password}</div>
                    </div>
                )}
                <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
                    <Link href='/account' className='inline-block rounded-full bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-2.5 font-bold text-[#00FFB2] transition-transform hover:scale-[1.02]'>
                        {tr('اذهب لحسابي', 'Go to my account')}
                    </Link>
                    <button type='button' onClick={() => setDone(null)} className='inline-block rounded-full px-6 py-2.5 font-bold text-[#1E7D67] hover:bg-[#1E7D67]/5'>
                        {tr('إنشاء متجر آخر', 'Create another')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className='mx-auto w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-8'>
            <h2 className='text-xl font-extrabold text-[#0B2923]'>{tr('أنشئ متجرك الإلكتروني', 'Create your online store')}</h2>
            <p className='mt-1 text-sm text-gray-500'>{tr('اسم، رابط، سوق، ألوان — والباقي من لوحة تحكم متجرك.', 'Name, URL, market, colours — the rest from your store dashboard.')}</p>

            {isAdmin && (
                <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4'>
                    <label className={label}>{tr('إنشاء لصالح مستخدم (إداري)', 'Create for a user (admin)')}</label>
                    <select value={ownerSel} onChange={(e) => setOwnerSel(e.target.value)} className={input}>
                        <option value=''>{tr('— لنفسي —', '— myself —')}</option>
                        <option value='__new__'>{tr('➕ مالك جديد…', '➕ New user…')}</option>
                        {adminUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.email} · {u.email}</option>)}
                    </select>
                    {ownerSel === '__new__' && (
                        <div className='mt-3 grid gap-3 sm:grid-cols-3'>
                            <input className={input} placeholder='email' dir='ltr' value={newOwner.email} onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} />
                            <input className={input} placeholder={tr('الاسم', 'Name')} value={newOwner.name} onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })} />
                            <input className={input} placeholder={tr('كلمة مرور (اختياري)', 'Password (optional)')} dir='ltr' value={newOwner.password} onChange={(e) => setNewOwner({ ...newOwner, password: e.target.value })} />
                        </div>
                    )}
                    {ownerSel && <p className='mt-2 text-xs text-amber-800'>{tr('سيتم الإنشاء بدون دفع على أي باقة.', 'Created without payment, on any plan.')}</p>}
                </div>
            )}

            {/* ── Identity ── */}
            <div className='mt-6 grid gap-4 sm:grid-cols-2'>
                <div>
                    <label className={label}>{tr('اسم المتجر (عربي)', 'Store name (Arabic)')}</label>
                    <input className={input} {...register('name', { required: true, minLength: 2 })} placeholder={tr('متجر زياد', 'متجر زياد')} />
                    {errors.name && <p className='mt-1 text-xs text-red-600'>{tr('الاسم مطلوب', 'Name is required')}</p>}
                </div>
                <div>
                    <label className={label}>{tr('اسم المتجر (إنجليزي)', 'Store name (English)')}</label>
                    <input className={input} dir='ltr' {...register('nameEn')} placeholder='Ziad Store' />
                </div>
                <div className='sm:col-span-2'>
                    <label className={label}>{tr('رابط المتجر', 'Store URL')}</label>
                    <div className='flex items-center gap-2' dir='ltr'>
                        <span className='text-sm text-gray-400'>https://</span>
                        <input className={`${input} max-w-[220px]`} placeholder='my-store' {...register('slug', { required: true, pattern: /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/ })} />
                        <span className='text-sm text-gray-500'>.commerce.nitg-eg.com</span>
                    </div>
                    {errors.slug && <p className='mt-1 text-xs text-red-600'>{tr('حروف إنجليزية صغيرة وأرقام وشرطات (3–40)', 'Lowercase letters, digits, hyphens (3–40)')}</p>}
                </div>
            </div>

            {/* ── Market ── */}
            <div className='mt-6 grid gap-4 sm:grid-cols-3'>
                <div>
                    <label className={label}>{tr('الدولة', 'Country')}</label>
                    <select className={input} value={market.code} onChange={(e) => setMarket(MARKETS.find((m) => m.code === e.target.value) ?? MARKETS[0])}>
                        {MARKETS.map((m) => <option key={m.code} value={m.code}>{isAr ? m.ar : m.en}</option>)}
                    </select>
                </div>
                <div>
                    <label className={label}>{tr('العملة / الضريبة', 'Currency / VAT')}</label>
                    <div className={`${input} bg-gray-50 text-gray-600`} dir='ltr'>{market.currency} · VAT {market.vat}%</div>
                </div>
                <div>
                    <label className={label}>{tr('لغة المتجر الافتراضية', 'Default store language')}</label>
                    <select className={input} value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value === 'en' ? 'en' : 'ar')}>
                        <option value='ar'>{tr('العربية', 'Arabic')}</option>
                        <option value='en'>{tr('الإنجليزية', 'English')}</option>
                    </select>
                </div>
            </div>

            {/* ── Brand ── */}
            <div className='mt-6 grid gap-4 sm:grid-cols-3'>
                <div>
                    <label className={label}>{tr('اللون الأساسي', 'Primary colour')}</label>
                    <div className='flex items-center gap-2'>
                        <input type='color' value={primary} onChange={(e) => setPrimary(e.target.value)} className='h-10 w-14 cursor-pointer rounded border border-gray-200' />
                        <span className='font-mono text-sm' dir='ltr'>{primary}</span>
                    </div>
                </div>
                <div>
                    <label className={label}>{tr('لون التمييز', 'Accent colour')}</label>
                    <div className='flex items-center gap-2'>
                        <input type='color' value={accent} onChange={(e) => setAccent(e.target.value)} className='h-10 w-14 cursor-pointer rounded border border-gray-200' />
                        <span className='font-mono text-sm' dir='ltr'>{accent}</span>
                    </div>
                </div>
                <div>
                    <label className={label}>{tr('اللوجو (اختياري)', 'Logo (optional)')}</label>
                    <input type='file' accept={LOGO_TYPES.join(',')} onChange={(e) => onLogo(e.target.files?.[0] ?? null)} className='block w-full text-sm text-gray-600 file:me-3 file:rounded-full file:border-0 file:bg-[#1E7D67]/10 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-[#1E7D67]' />
                </div>
            </div>

            {/* ── Contact & social ── */}
            <div className='mt-6 grid gap-4 sm:grid-cols-3'>
                <div><label className={label}>{tr('الهاتف', 'Phone')}</label><input className={input} dir='ltr' {...register('contactPhone')} placeholder='+2010…' /></div>
                <div><label className={label}>WhatsApp</label><input className={input} dir='ltr' {...register('contactWhatsapp')} placeholder='+2010…' /></div>
                <div><label className={label}>{tr('بريد المتجر', 'Store e-mail')}</label><input className={input} dir='ltr' type='email' {...register('contactEmail')} placeholder='hello@…' /></div>
                <div><label className={label}>Instagram</label><input className={input} dir='ltr' {...register('socialInstagram')} placeholder='https://instagram.com/…' /></div>
                <div><label className={label}>Facebook</label><input className={input} dir='ltr' {...register('socialFacebook')} placeholder='https://facebook.com/…' /></div>
                <div><label className={label}>TikTok</label><input className={input} dir='ltr' {...register('socialTiktok')} placeholder='https://tiktok.com/@…' /></div>
            </div>

            {/* ── Plan ── */}
            <div className='mt-8'>
                <label className={label}>{tr('الباقة', 'Plan')}</label>
                {licenses.length === 0 ? (
                    <p className='rounded-xl bg-gray-50 p-4 text-sm text-gray-500'>{tr('لا توجد باقات متاجر متاحة حالياً.', 'No store plans are available yet.')}</p>
                ) : (
                    <div className='grid gap-3 sm:grid-cols-2'>
                        {licenses.map((l) => {
                            const active = l.key === tierKey
                            const price = billingCycle === 'monthly' && (l.priceEgpMonthly ?? 0) > 0 ? `${l.priceEgpMonthly} EGP / ${tr('شهر', 'mo')}` : (l.priceEgp ?? 0) > 0 ? `${l.priceEgp} EGP / ${tr('سنة', 'yr')}` : tr('مجاني', 'Free')
                            const feats = Object.keys(l.features ?? {}).filter((k) => (l.features ?? {})[k])
                            return (
                                <button type='button' key={l.key} onClick={() => setValue('tier', l.key)}
                                    className={`rounded-xl border p-4 text-start transition ${active ? 'border-[#1E7D67] bg-[#1E7D67]/5 ring-2 ring-[#1E7D67]/20' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <div className='flex items-center justify-between'>
                                        <span className='font-extrabold text-[#0B2923]'>{l.name}</span>
                                        <span className='text-sm font-bold text-[#1E7D67]'>{price}</span>
                                    </div>
                                    <p className='mt-2 text-xs text-gray-500'>
                                        {tr('منتجات', 'Products')}: {cap(l.limits?.products, tr('غير محدود', 'Unlimited'))} · {tr('فريق', 'Staff')}: {cap(l.limits?.staff, tr('غير محدود', 'Unlimited'))}
                                        {feats.length ? ` · ${feats.map((f) => (isAr ? STORE_FEATURES[f]?.ar : STORE_FEATURES[f]?.en) ?? f).join('، ')}` : ''}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                )}
                {paid && (
                    <div className='mt-3 flex flex-wrap items-center gap-4 text-sm'>
                        {monthlyAvailable && (
                            <div className='inline-flex rounded-full bg-gray-100 p-1'>
                                {(['annual', 'monthly'] as const).map((c) => (
                                    <button type='button' key={c} onClick={() => setBillingCycle(c)}
                                        className={`rounded-full px-3 py-1 font-bold ${billingCycle === c ? 'bg-white text-[#0B2923] shadow' : 'text-gray-500'}`}>
                                        {c === 'annual' ? tr('سنوي', 'Annual') : tr('شهري', 'Monthly')}
                                    </button>
                                ))}
                            </div>
                        )}
                        {autoRenewEnabled && (
                            <label className='inline-flex items-center gap-2 text-gray-700'>
                                <input type='checkbox' checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                                {tr('تجديد تلقائي', 'Auto-renew')}
                            </label>
                        )}
                    </div>
                )}
            </div>

            <input type='text' tabIndex={-1} autoComplete='off' className='hidden' {...register('_hp')} />

            <div className='mt-8 flex items-center justify-between gap-4'>
                <p className='text-xs text-gray-500'>{paid && !(isAdmin && ownerSel) ? tr('هتتحوّل لصفحة الدفع، والمتجر يتجهّز بعد الدفع مباشرة.', 'You will be taken to payment; the store is prepared right after.') : ''}</p>
                <button type='submit' disabled={isSubmitting || !tierKey}
                    className='rounded-full bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-8 py-3 font-extrabold text-[#00FFB2] transition-transform hover:scale-[1.02] disabled:opacity-60'>
                    {isSubmitting ? '…' : paid && !(isAdmin && ownerSel) ? tr('ادفع وأنشئ المتجر', 'Pay & create store') : tr('أنشئ المتجر', 'Create store')}
                </button>
            </div>
        </form>
    )
}
