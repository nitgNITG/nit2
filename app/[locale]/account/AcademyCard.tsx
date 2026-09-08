'use client'

import React, { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { connectLinks } from '@/lib/connectLinks'
import DeletePlatformButton from './DeletePlatformButton'
import BuildProductForm from '../build-product/BuildProductForm'

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export type ClientAcademy = {
    id: string; name: string; slug: string; status: string; createdAt: string
    tier?: string
    validUntil?: string | null
}

type Tier = { key: string; name: string; price: number; priceEgp?: number; priceEgpMonthly?: number; durationDays?: number; active: boolean; order?: number }
type SubPayment = { amount: number; currency: string; status: string; purpose: string; date: string | null }
type Sub = {
    academySlug: string; status: string; autoRenew: boolean; amountEgp: number; currency: string
    intervalDays: number; currentPeriodEnd: string | null; nextAttemptAt: string | null
    lastError?: string | null; card: { brand?: string | null; last4?: string | null } | null
    payments?: SubPayment[]
}

export default function AcademyCard({ academy, domain }: { academy: ClientAcademy; domain: string }) {
    const t = useTranslations('Dashboard')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const [live, setLive] = useState(academy.status === 'live')
    const [qr, setQr] = useState<string>('')
    const [renewing, setRenewing] = useState(false)
    const [tiers, setTiers] = useState<Tier[]>([])
    const [upgradeTo, setUpgradeTo] = useState('')
    const [upgrading, setUpgrading] = useState(false)
    const [editing, setEditing] = useState(false)
    const [highlight, setHighlight] = useState(false)
    const [sub, setSub] = useState<Sub | null>(null)
    const [subEnabled, setSubEnabled] = useState(false) // auto-renew feature on (server flag)
    const [subBusy, setSubBusy] = useState(false)
    const [renewAuto, setRenewAuto] = useState(true) // opt into auto-renew when renewing
    const [renewCycle, setRenewCycle] = useState<'monthly' | 'annual'>('annual')
    const links = connectLinks(academy.slug, domain)

    // Auto-renew subscription for this academy (if the feature is on and one exists).
    useEffect(() => {
        let cancelled = false
        fetch('/api/subscriptions', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (cancelled || !d) return
                setSubEnabled(!!d.enabled)
                if (!d.enabled) return
                const found = (d.subscriptions ?? []).find((s: Sub) => s.academySlug === academy.slug) ?? null
                setSub(found)
                if (found) setRenewCycle(found.intervalDays === 30 ? 'monthly' : 'annual')
            })
            .catch(() => { /* feature optional */ })
        return () => { cancelled = true }
    }, [academy.slug])

    const updateCard = async () => {
        if (subBusy) return
        setSubBusy(true)
        try {
            const res = await fetch('/api/payments/kashier/create', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purpose: 'update_card', slug: academy.slug }),
            })
            const d = await res.json()
            if (res.ok && d.url) { window.location.href = d.url; return }
            alert(d.error || tr('تعذّر بدء تحديث البطاقة.', 'Could not start card update.'))
        } catch {
            alert(tr('تعذّر بدء تحديث البطاقة.', 'Could not start card update.'))
        } finally {
            setSubBusy(false)
        }
    }

    const toggleAutoRenew = async (on: boolean) => {
        if (subBusy) return
        if (!on && !confirm(tr('إلغاء التجديد التلقائي؟ ستظل الأكاديمية تعمل حتى نهاية المدة الحالية.',
            'Cancel auto-renew? Your academy keeps running until the end of the current term.'))) return
        setSubBusy(true)
        try {
            const res = await fetch(`/api/subscriptions/${academy.slug}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoRenew: on }),
            })
            const d = await res.json()
            if (res.ok) setSub((prev) => (prev ? { ...prev, autoRenew: d.autoRenew, status: d.status } : prev))
            else alert(d.error || tr('تعذّر التحديث، حاول تاني.', 'Could not update, please try again.'))
        } catch {
            alert(tr('تعذّر التحديث، حاول تاني.', 'Could not update, please try again.'))
        } finally {
            setSubBusy(false)
        }
    }

    // Deep-link support: the in-academy gear dropdown links here with
    // #<slug> (e.g. .../account#demo). Scroll this card into view and flash a
    // ring so the owner lands directly on the academy they came from.
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (decodeURIComponent(window.location.hash.replace(/^#/, '')) !== academy.slug) return
        const el = document.getElementById(academy.slug)
        if (!el) return
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setHighlight(true)
        const timer = setTimeout(() => setHighlight(false), 2600)
        return () => clearTimeout(timer)
    }, [academy.slug])

    // Subscription term. validUntil null = never expires (free/unlimited plan).
    const suspended = academy.status === 'suspended'
    const expiryMs = academy.validUntil ? Date.parse(academy.validUntil) : null
    const expired = expiryMs != null && expiryMs < Date.now()
    const daysLeft = expiryMs != null ? Math.ceil((expiryMs - Date.now()) / 86_400_000) : null
    // Show the renew/enable block when expiring/expired, OR (feature on, paid plan,
    // no subscription yet) so an existing owner can opt into auto-renew any time.
    const canOptIn = subEnabled && !sub
    const showRenew = expiryMs != null && (expired || (daysLeft != null && daysLeft <= 30) || canOptIn)
    const expiryLabel = expiryMs != null
        ? new Date(expiryMs).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
        : null

    const renew = async () => {
        if (renewing || !academy.tier) return
        setRenewing(true)
        try {
            const curTier = tiers.find((t) => t.key === academy.tier)
            const canMonthly = (curTier?.priceEgpMonthly ?? 0) > 0
            const cycle = subEnabled && renewCycle === 'monthly' && canMonthly ? 'monthly' : 'annual'
            const res = await fetch('/api/payments/kashier/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    purpose: 'renew', slug: academy.slug, tier: academy.tier,
                    cycle, autoRenew: subEnabled ? renewAuto : false,
                }),
            })
            const data = await res.json()
            if (res.ok && data.url) { window.location.href = data.url; return }
            alert(data.error || tr('تعذّر بدء التجديد، حاول تاني.', 'Could not start renewal, please try again.'))
        } catch {
            alert(tr('تعذّر بدء التجديد، حاول تاني.', 'Could not start renewal, please try again.'))
        } finally {
            setRenewing(false)
        }
    }

    // Load tiers once the site is live so we can offer paid upgrades.
    useEffect(() => {
        if (!live || !academy.tier) return
        let cancelled = false
        fetch('/api/licenses', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => { if (!cancelled) setTiers((d.licenses ?? []).filter((l: Tier) => l.active)) })
            .catch(() => { /* upgrade is optional */ })
        return () => { cancelled = true }
    }, [live, academy.tier])

    // Rank tiers by order then EGP charge; offer only strictly-higher paid tiers.
    const rank = (t: Tier) => (t.order ?? 0) * 1_000_000 + (t.priceEgp ?? 0)
    const current = tiers.find((t) => t.key === academy.tier)
    const upgradeOptions = current
        ? tiers.filter((t) => (t.priceEgp ?? 0) > 0 && rank(t) > rank(current))
        : []

    const upgrade = async () => {
        if (upgrading || !upgradeTo) return
        setUpgrading(true)
        try {
            const res = await fetch('/api/payments/kashier/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purpose: 'upgrade', slug: academy.slug, tier: upgradeTo }),
            })
            const data = await res.json()
            if (res.ok && data.url) { window.location.href = data.url; return }
            alert(data.error || tr('تعذّر بدء الترقية، حاول تاني.', 'Could not start upgrade, please try again.'))
        } catch {
            alert(tr('تعذّر بدء الترقية، حاول تاني.', 'Could not start upgrade, please try again.'))
        } finally {
            setUpgrading(false)
        }
    }

    // While the site is still being prepared, poll until it answers 200.
    // Suspended academies still serve a notice page (200), so skip polling — we
    // don't want to flip the badge to "live" while the term is expired.
    useEffect(() => {
        if (live || suspended) return
        let stopped = false
        let attempts = 0
        const check = async () => {
            attempts++
            try {
                const res = await fetch(`/api/academies/${academy.slug}/status`, { cache: 'no-store' })
                const data = await res.json()
                if (!stopped && data.live) { setLive(true); return }
            } catch { /* keep trying */ }
            if (!stopped && attempts < 40) setTimeout(check, 8000)
        }
        const first = setTimeout(check, 3000)
        return () => { stopped = true; clearTimeout(first) }
    }, [live, academy.slug])

    // QR encodes the deep link (per TENANT_CONNECT_LINKS.md). Built client-side once live.
    useEffect(() => {
        if (!live) return
        let cancelled = false
        import('qrcode')
            .then(({ default: QRCode }) => QRCode.toDataURL(links.deeplink, { margin: 1, width: 264 }))
            .then((dataUrl) => { if (!cancelled) setQr(dataUrl) })
            .catch(() => { /* QR is best-effort — the buttons + URL still work */ })
        return () => { cancelled = true }
    }, [live, links.deeplink])

    return (
        <div
            id={academy.slug}
            className={`scroll-mt-24 rounded-2xl bg-[#F5F3EE] p-5 flex flex-col gap-3 shadow-sm transition-shadow ${highlight ? 'ring-2 ring-[#00c98e]' : 'ring-1 ring-black/5'}`}
        >
            <div className='flex items-center gap-2'>
                {suspended ? (
                    <span className='h-2.5 w-2.5 rounded-full bg-red-500' />
                ) : live ? (
                    <span className='relative flex h-2.5 w-2.5'>
                        <span className='absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60 animate-ping motion-reduce:hidden' />
                        <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00c98e]' />
                    </span>
                ) : (
                    <span className='h-2.5 w-2.5 rounded-full bg-[#E8A13C] animate-pulse motion-reduce:animate-none' />
                )}
                <span className={`text-xs font-bold ${suspended ? 'text-red-600' : live ? 'text-[#0b8f66]' : 'text-[#b9791f]'}`}>
                    {suspended ? tr('موقوفة', 'Suspended') : live ? t('statusLive') : t('statusPreparing')}
                </span>
            </div>

            <div>
                <p className='text-lg font-extrabold text-[#0B2923]'>{academy.name}</p>
                <p dir='ltr' className='mt-0.5 text-xs text-[#0B2923]/50 truncate' style={{ fontFamily: MONO }}>
                    {academy.slug}.{domain}
                </p>
            </div>

            {live ? (
                <div className='mt-1 flex flex-col gap-3'>
                    <a
                        href={links.site}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2923] px-4 py-2 text-sm font-bold text-[#00FFB2] hover:bg-[#0e3329] transition-colors'
                    >
                        {t('openPlatform')} ↗
                    </a>

                    {/* App connect links — opens the NIT Academy app pointed at this academy. */}
                    <div className='rounded-xl bg-white ring-1 ring-black/5 p-4 flex flex-col items-center gap-3'>
                        <p className='text-xs font-bold text-[#0B2923]'>{t('appLinksTitle')}</p>

                        {qr ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qr} alt='' width={132} height={132} className='rounded-lg' />
                        ) : (
                            <div className='h-[132px] w-[132px] rounded-lg bg-black/5 animate-pulse' />
                        )}
                        <p className='text-[11px] text-[#0B2923]/50 text-center'>{t('scanHint')}</p>

                        <div className='flex w-full flex-col gap-2'>
                            <a
                                href={links.playUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0B2923]/15 px-3 py-2 text-xs font-semibold text-[#0B2923] hover:bg-black/5 transition-colors'
                            >
                                ▶ {t('getOnPlay')}
                            </a>
                            <a
                                href={links.deeplink}
                                className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0B2923]/15 px-3 py-2 text-xs font-semibold text-[#0B2923] hover:bg-black/5 transition-colors'
                            >
                                📱 {t('openInApp')}
                            </a>
                        </div>

                        <div className='w-full'>
                            <p className='text-[11px] text-[#0B2923]/50 mb-1'>{t('orAddress')}</p>
                            <code
                                dir='ltr'
                                className='block w-full select-all rounded-md bg-black/5 px-2 py-1.5 text-[11px] text-[#0B2923] break-all'
                                style={{ fontFamily: MONO }}
                            >
                                {links.site}
                            </code>
                        </div>
                    </div>
                </div>
            ) : suspended ? (
                <div className='mt-1 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-700 text-center'>
                    {tr('انتهى اشتراك هذه الأكاديمية وتم إيقافها مؤقتاً. جدّد الاشتراك لإعادة تشغيلها — بياناتك محفوظة.',
                        'This academy’s subscription ended and it is paused. Renew to bring it back — your data is safe.')}
                </div>
            ) : (
                <div className='mt-1 rounded-lg bg-[#E8A13C]/10 px-4 py-2 text-sm text-[#b9791f] text-center'>
                    {t('preparingHint')}
                </div>
            )}

            {/* Prominent expiry warning — final week or already expired (still in
                grace, before the suspend cron pauses it). Suspended shows its own
                banner above, so skip it here. */}
            {!suspended && expiryMs != null &&
                (expired || (daysLeft != null && daysLeft <= 7)) && (
                <div
                    className={`rounded-lg px-4 py-2.5 text-sm text-center font-semibold ${expired ? 'bg-red-500/10 text-red-700' : 'bg-[#E8A13C]/15 text-[#b9791f]'}`}
                >
                    {expired
                        ? tr('انتهى اشتراك أكاديميتك — جدّد الآن قبل إيقافها. بياناتك محفوظة.',
                            'Your academy has expired — renew now before it’s paused. Your data is safe.')
                        : tr(`ينتهي اشتراك أكاديميتك خلال ${daysLeft} يوم — جدّد الآن لتجنّب أي انقطاع.`,
                            `Your academy expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — renew now to avoid interruption.`)}
                </div>
            )}

            {/* Subscription term + renew (only for plans that expire). */}
            {expiryMs != null && (
                <div className='rounded-lg bg-white/60 ring-1 ring-black/5 px-3 py-2 text-xs'>
                    <div className='flex items-center justify-between gap-2'>
                        <span className='text-[#0B2923]/60'>
                            {expired
                                ? tr('انتهى في', 'Expired on')
                                : tr('ساري حتى', 'Valid until')}
                        </span>
                        <span dir='ltr' className={`font-bold ${expired ? 'text-red-600' : daysLeft != null && daysLeft <= 7 ? 'text-[#b9791f]' : 'text-[#0B2923]'}`}>
                            {expiryLabel}
                        </span>
                    </div>
                    {!expired && daysLeft != null && daysLeft <= 30 && (
                        <p className='mt-0.5 text-[#b9791f]'>
                            {tr(`باقي ${daysLeft} يوم`, `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`)}
                        </p>
                    )}
                    {showRenew && academy.tier && (() => {
                        const curTier = tiers.find((t) => t.key === academy.tier)
                        const canMonthly = (curTier?.priceEgpMonthly ?? 0) > 0
                        const price = renewCycle === 'monthly' && canMonthly ? (curTier?.priceEgpMonthly ?? 0) : (curTier?.priceEgp ?? 0)
                        return (
                            <div className='mt-2 flex flex-col gap-2'>
                                {/* Auto-renew opt-in (only when there's no subscription yet + feature on). */}
                                {canOptIn && (
                                    <>
                                        {canMonthly && (
                                            <div className='inline-flex self-start rounded-full border border-black/10 bg-white p-0.5 text-[11px]'>
                                                {(['monthly', 'annual'] as const).map((c) => (
                                                    <button
                                                        key={c}
                                                        type='button'
                                                        onClick={() => setRenewCycle(c)}
                                                        className={`rounded-full px-2.5 py-0.5 font-bold transition-colors ${renewCycle === c ? 'bg-[#1E7D67] text-white' : 'text-gray-500'}`}
                                                    >
                                                        {c === 'monthly' ? tr('شهري', 'Monthly') : tr('سنوي', 'Annual')}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <label className='flex cursor-pointer items-start gap-2 rounded-lg border border-[#1E7D67]/25 bg-[#1E7D67]/5 p-2'>
                                            <input type='checkbox' checked={renewAuto} onChange={(e) => setRenewAuto(e.target.checked)} className='mt-0.5 h-4 w-4 accent-[#1E7D67]' />
                                            <span className='text-[#0B2923]/80'>
                                                {tr(
                                                    `فعّل التجديد التلقائي — احفظ بطاقتي وجدّد ${renewCycle === 'monthly' ? 'شهريًا' : 'سنويًا'} (${price} ج.م) حتى ألغيه.`,
                                                    `Turn on auto-renew — save my card and renew ${renewCycle === 'monthly' ? 'monthly' : 'yearly'} (${price} EGP) until I cancel.`,
                                                )}
                                            </span>
                                        </label>
                                    </>
                                )}
                                <button
                                    onClick={renew}
                                    disabled={renewing}
                                    className='w-full rounded-lg bg-[#0B2923] px-3 py-1.5 text-xs font-bold text-[#00FFB2] hover:bg-[#0e3329] disabled:opacity-60 transition-colors'
                                >
                                    {renewing
                                        ? tr('جارٍ التحويل…', 'Redirecting…')
                                        : canOptIn && renewAuto
                                            ? tr('جدّد وفعّل التجديد التلقائي', 'Renew & turn on auto-renew')
                                            : tr('تجديد الاشتراك', 'Renew subscription')}
                                </button>
                                {canOptIn && !expired && daysLeft != null && daysLeft > 30 && (
                                    <p className='text-[10px] text-[#0B2923]/45'>
                                        {tr('التجديد الآن يمدّد مدتك الحالية ويحفظ بطاقتك للتجديد التلقائي.',
                                            'Renewing now extends your current term and saves your card for auto-renew.')}
                                    </p>
                                )}
                            </div>
                        )
                    })()}
                </div>
            )}

            {/* Auto-renew subscription — status, next charge, saved card, cancel/resume. */}
            {sub && (
                <div className='rounded-lg bg-white/60 ring-1 ring-black/5 px-3 py-2 text-xs'>
                    <div className='flex items-center justify-between gap-2'>
                        <span className='text-[#0B2923]/60'>{tr('التجديد التلقائي', 'Auto-renew')}</span>
                        <span className={`font-bold ${sub.autoRenew ? 'text-[#0b8f66]' : 'text-[#0B2923]/50'}`}>
                            {sub.autoRenew ? tr('مُفعّل', 'On') : tr('مُلغى', 'Off')}
                        </span>
                    </div>
                    {sub.card && (
                        <p className='mt-0.5 text-[#0B2923]/60' dir='ltr'>
                            {(sub.card.brand || 'Card')} •••• {sub.card.last4 || '****'}
                        </p>
                    )}
                    {sub.autoRenew && sub.nextAttemptAt && (
                        <p className='mt-0.5 text-[#0B2923]/60'>
                            {tr('التجديد القادم', 'Next charge')}:{' '}
                            <span dir='ltr' className='font-semibold'>
                                {new Date(sub.nextAttemptAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>{' '}— {sub.amountEgp} {isAr ? 'ج.م' : 'EGP'}
                        </p>
                    )}
                    {sub.status === 'past_due' && (
                        <p className='mt-0.5 text-red-600'>
                            {tr('فشل آخر تجديد — سنعيد المحاولة. حدّث بطاقتك بالتجديد يدويًا.',
                                'Last renewal failed — we’ll retry. Update your card by renewing manually.')}
                        </p>
                    )}
                    <div className='mt-2 flex gap-2'>
                        <button
                            onClick={() => toggleAutoRenew(!sub.autoRenew)}
                            disabled={subBusy}
                            className='flex-1 rounded-lg border border-[#0B2923]/15 px-3 py-1.5 text-xs font-bold text-[#0B2923] hover:bg-black/5 disabled:opacity-60 transition-colors'
                        >
                            {subBusy ? tr('جارٍ…', '…') : sub.autoRenew ? tr('إلغاء التجديد التلقائي', 'Cancel auto-renew') : tr('تفعيل التجديد التلقائي', 'Enable auto-renew')}
                        </button>
                        {sub.autoRenew && (
                            <button
                                onClick={updateCard}
                                disabled={subBusy}
                                title={tr('تحديث البطاقة (رسم تحقق بسيط)', 'Update card (small verification charge)')}
                                className='rounded-lg border border-[#0B2923]/15 px-3 py-1.5 text-xs font-bold text-[#0B2923] hover:bg-black/5 disabled:opacity-60 transition-colors'
                            >
                                {tr('تحديث البطاقة', 'Update card')}
                            </button>
                        )}
                    </div>

                    {/* Billing history — recent auto-renew / card charges. */}
                    {sub.payments && sub.payments.length > 0 && (
                        <details className='mt-2'>
                            <summary className='cursor-pointer text-[11px] font-semibold text-[#0B2923]/60'>
                                {tr('سجل الفواتير', 'Billing history')}
                            </summary>
                            <ul className='mt-1 space-y-0.5'>
                                {sub.payments.map((pmt, i) => (
                                    <li key={i} className='flex items-center justify-between gap-2 text-[11px]'>
                                        <span className='text-[#0B2923]/60' dir='ltr'>
                                            {pmt.date ? new Date(pmt.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                        </span>
                                        <span dir='ltr' className='font-semibold text-[#0B2923]/80'>{pmt.amount} {isAr ? 'ج.م' : 'EGP'}</span>
                                        <span className={pmt.status === 'paid' ? 'text-[#0b8f66]' : pmt.status === 'failed' ? 'text-red-600' : 'text-[#b9791f]'}>
                                            {pmt.status === 'paid' ? '✓' : pmt.status === 'failed' ? '✗' : '…'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}

            {/* Upgrade to a higher paid tier (only when live + options exist). */}
            {live && upgradeOptions.length > 0 && (
                <div className='rounded-lg bg-white/60 ring-1 ring-black/5 px-3 py-2 text-xs'>
                    <p className='text-[#0B2923]/60 mb-1.5'>{tr('ترقية الباقة', 'Upgrade plan')}</p>
                    <div className='flex gap-2'>
                        <select
                            value={upgradeTo}
                            onChange={(e) => setUpgradeTo(e.target.value)}
                            className='min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs text-[#0B2923]'
                        >
                            <option value=''>{tr('اختر باقة…', 'Choose a plan…')}</option>
                            {upgradeOptions.map((o) => (
                                <option key={o.key} value={o.key}>
                                    {o.name} — {o.priceEgp} {isAr ? 'ج.م' : 'EGP'}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={upgrade}
                            disabled={upgrading || !upgradeTo}
                            className='shrink-0 rounded-lg bg-[#0B2923] px-3 py-1.5 text-xs font-bold text-[#00FFB2] hover:bg-[#0e3329] disabled:opacity-60 transition-colors'
                        >
                            {upgrading ? tr('جارٍ…', '…') : tr('ترقية', 'Upgrade')}
                        </button>
                    </div>
                </div>
            )}

            {/* Owner actions: edit branding (live/suspended only) + delete. */}
            <div className='mt-auto flex items-center justify-between border-t border-black/5 pt-3'>
                {(live || suspended) ? (
                    <button
                        onClick={() => setEditing(true)}
                        className='inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-[#0B2923] hover:bg-black/5 transition-colors'
                    >
                        🎨 {tr('تعديل الأكاديمية', 'Edit academy')}
                    </button>
                ) : <span />}
                <DeletePlatformButton
                    slug={academy.slug}
                    name={academy.name}
                    triggerClassName='inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-500/10 transition-colors'
                />
            </div>

            {/* Edit-branding modal — reuses the build form in edit mode (owner-scoped
                via /api/academies/<slug>/branding). */}
            {editing && (
                <div className='fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4'>
                    <div className='relative my-8 w-full max-w-xl'>
                        <div className='mb-2 flex items-center justify-between text-white'>
                            <span className='font-bold'>🎨 {tr('تعديل', 'Edit')} — <span style={{ fontFamily: MONO }}>{academy.slug}</span></span>
                            <button
                                onClick={() => setEditing(false)}
                                className='rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20'
                            >
                                ✕ {tr('إغلاق', 'Close')}
                            </button>
                        </div>
                        <BuildProductForm editSlug={academy.slug} onSuccess={() => setEditing(false)} />
                    </div>
                </div>
            )}
        </div>
    )
}
