'use client'

// A store on the owner's account page — same card as AcademyCard (light card,
// status dot, name + address, actions) so the "My products" grid reads as one
// list. Unlike AcademyCard it never probes the site: the provisioner reports
// each step to nit2, so while queued/provisioning the card polls
// /api/stores/<slug>/status every 4 s and shows the live step + progress bar,
// then "Open store / Dashboard" once live, or the failure reason.
import React, { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FiExternalLink, FiSettings, FiTrash2, FiAlertTriangle } from 'react-icons/fi'

export type ClientStore = {
    id: string; name: string; slug: string; status: string; createdAt: string; tier: string
    validUntil: string | null; url: string
    progress: { step?: number; total?: number; label?: string } | null
    lastError: string | null
}

type Status = { status: string; live: boolean; url: string; progress: ClientStore['progress']; lastError: string | null }

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export default function StoreCard({ store, onDeleted }: { store: ClientStore; onDeleted?: (slug: string) => void }) {
    const t = useTranslations('Dashboard')
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const [st, setSt] = useState<Status>({ status: store.status, live: store.status === 'live', url: store.url, progress: store.progress, lastError: store.lastError })
    const [busy, setBusy] = useState(false)

    const inFlight = st.status === 'queued' || st.status === 'provisioning'
    const live = st.status === 'live'
    const suspended = st.status === 'suspended'
    const failed = st.status === 'failed'

    useEffect(() => {
        if (!inFlight) return
        let cancelled = false
        const tick = async () => {
            try {
                const r = await fetch(`/api/stores/${store.slug}/status`, { cache: 'no-store' })
                if (!r.ok) return
                const d = (await r.json()) as Status
                if (!cancelled) setSt(d)
            } catch { /* keep polling */ }
        }
        tick()
        const id = setInterval(tick, 4000)
        return () => { cancelled = true; clearInterval(id) }
    }, [inFlight, store.slug])

    const remove = async () => {
        if (!confirm(tr('حذف المتجر نهائياً مع كل بياناته؟', 'Delete this store and all its data permanently?'))) return
        setBusy(true)
        try {
            const r = await fetch(`/api/stores/${store.slug}`, { method: 'DELETE' })
            if (r.ok) onDeleted?.(store.slug); else alert((await r.json())?.error || tr('تعذّر الحذف.', 'Could not delete.'))
        } finally { setBusy(false) }
    }

    // Expiry maths — same thresholds as the academy card (final week / expired).
    const expiryMs = store.validUntil ? new Date(store.validUntil).getTime() : null
    const daysLeft = expiryMs != null ? Math.ceil((expiryMs - Date.now()) / 86_400_000) : null
    const expired = daysLeft != null && daysLeft < 0

    const pct = st.progress?.total ? Math.round(((st.progress.step ?? 0) / st.progress.total) * 100) : 0
    const host = st.url.replace(/^https?:\/\//, '')

    return (
        <div id={store.slug} className='scroll-mt-24 rounded-2xl bg-[#F5F3EE] p-5 flex flex-col gap-3 shadow-sm ring-1 ring-black/5'>
            <div className='flex items-center gap-2'>
                {suspended || failed ? (
                    <span className='h-2.5 w-2.5 rounded-full bg-red-500' />
                ) : live ? (
                    <span className='relative flex h-2.5 w-2.5'>
                        <span className='absolute inline-flex h-full w-full rounded-full bg-[#00FFB2] opacity-60 animate-ping motion-reduce:hidden' />
                        <span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00c98e]' />
                    </span>
                ) : (
                    <span className='h-2.5 w-2.5 rounded-full bg-[#E8A13C] animate-pulse motion-reduce:animate-none' />
                )}
                <span className={`text-xs font-bold ${suspended || failed ? 'text-red-600' : live ? 'text-[#0b8f66]' : 'text-[#b9791f]'}`}>
                    {suspended ? tr('موقوف', 'Suspended') : failed ? tr('فشل التجهيز', 'Failed') : live ? t('statusLive') : t('statusPreparing')}
                </span>
                <span className='ms-auto rounded-full bg-[#0B2923]/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0B2923]/60'>
                    🛒 {t('kindStore')} · {store.tier}
                </span>
            </div>

            <div>
                <p className='text-lg font-extrabold text-[#0B2923]'>{store.name}</p>
                <p dir='ltr' className='mt-0.5 text-xs text-[#0B2923]/50 truncate' style={{ fontFamily: MONO }}>{host}</p>
            </div>

            {inFlight && (
                <div className='mt-1 rounded-lg bg-[#E8A13C]/10 px-4 py-3 text-sm text-[#b9791f]'>
                    <div className='flex items-center justify-between text-xs font-semibold'>
                        <span>{st.progress?.label || tr('في الانتظار…', 'Queued…')}</span>
                        {st.progress?.total ? <span style={{ fontFamily: MONO }}>{st.progress.step}/{st.progress.total}</span> : null}
                    </div>
                    <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8A13C]/20'>
                        <div className='h-full rounded-full bg-[#E8A13C] transition-all duration-500' style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                    <p className='mt-2 text-[11px] text-[#b9791f]/80'>{tr('عادةً أقل من دقيقة. هيوصلك إيميل ببيانات الدخول.', 'Usually under a minute. Login details arrive by e-mail.')}</p>
                </div>
            )}

            {failed && (
                <div className='mt-1 rounded-lg bg-red-500/10 px-4 py-3 text-xs text-red-700'>
                    <div className='flex items-center gap-1.5 font-bold'><FiAlertTriangle /> {tr('تعذّر تجهيز المتجر', 'Provisioning failed')}</div>
                    {st.lastError && <p className='mt-1 break-words text-[11px] text-red-700/80' dir='ltr' style={{ fontFamily: MONO }}>{st.lastError.slice(0, 200)}</p>}
                    <p className='mt-1 text-red-700/80'>{tr('تم إبلاغ الدعم؛ هيتم إعادة المحاولة أو التواصل معك.', 'Support has been notified and will retry or contact you.')}</p>
                </div>
            )}

            {suspended && (
                <div className='mt-1 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-700 text-center'>
                    {tr('انتهى اشتراك هذا المتجر وتم إيقافه مؤقتاً. جدّد الاشتراك لإعادة تشغيله — بياناتك محفوظة.',
                        'This store’s subscription ended and it is paused. Renew to bring it back — your data is safe.')}
                </div>
            )}

            {live && (
                <div className='mt-1 flex flex-col gap-2'>
                    <a href={st.url} target='_blank' rel='noopener noreferrer'
                        className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2923] px-4 py-2 text-sm font-bold text-[#00FFB2] hover:bg-[#0e3329] transition-colors'>
                        <FiExternalLink /> {tr('افتح المتجر', 'Open store')} ↗
                    </a>
                    <a href={`${st.url}/dashboard`} target='_blank' rel='noopener noreferrer'
                        className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#0B2923]/15 px-3 py-2 text-xs font-semibold text-[#0B2923] hover:bg-black/5 transition-colors'>
                        <FiSettings /> {tr('لوحة التحكم', 'Dashboard')}
                    </a>
                </div>
            )}

            {/* Expiry warning — final week or already expired (still in grace). */}
            {!suspended && !failed && daysLeft != null && (expired || daysLeft <= 7) && (
                <div className={`rounded-lg px-4 py-2.5 text-sm text-center font-semibold ${expired ? 'bg-red-500/10 text-red-700' : 'bg-[#E8A13C]/15 text-[#b9791f]'}`}>
                    {expired
                        ? tr('انتهى اشتراك متجرك — جدّد الآن قبل إيقافه. بياناتك محفوظة.', 'Your store’s subscription has ended — renew now before it is paused. Your data is safe.')
                        : tr(`باقي ${daysLeft} يوم على انتهاء الاشتراك.`, `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on the subscription.`)}
                </div>
            )}

            <div className='mt-auto flex items-center justify-between pt-1 text-xs text-[#0B2923]/50'>
                <span>
                    {store.validUntil
                        ? `${tr('ساري حتى', 'Valid until')} ${new Date(store.validUntil).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}`
                        : tr('بدون انتهاء', 'No expiry')}
                </span>
                <button type='button' onClick={remove} disabled={busy || inFlight}
                    className='inline-flex items-center gap-1 rounded-full px-2 py-1 text-[#0B2923]/40 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40'>
                    <FiTrash2 /> {tr('حذف', 'Delete')}
                </button>
            </div>
        </div>
    )
}
