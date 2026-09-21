'use client'

// A store on the owner's account page. Unlike AcademyCard it never probes the
// site: the provisioner reports each step to nit2, so the card polls
// /api/stores/<slug>/status (every 4 s while queued/provisioning) and shows the
// current step, then "Open store / Open dashboard" once live, or the failure
// reason with a support hint.
import React, { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { FiExternalLink, FiSettings, FiTrash2, FiAlertTriangle } from 'react-icons/fi'

export type ClientStore = {
    id: string; name: string; slug: string; status: string; createdAt: string; tier: string
    validUntil: string | null; url: string
    progress: { step?: number; total?: number; label?: string } | null
    lastError: string | null
}

type Status = { status: string; live: boolean; url: string; progress: ClientStore['progress']; lastError: string | null }

export default function StoreCard({ store, onDeleted }: { store: ClientStore; onDeleted?: (slug: string) => void }) {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const [st, setSt] = useState<Status>({ status: store.status, live: store.status === 'live', url: store.url, progress: store.progress, lastError: store.lastError })
    const [busy, setBusy] = useState(false)

    const inFlight = st.status === 'queued' || st.status === 'provisioning'
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

    const pct = st.progress?.total ? Math.round(((st.progress.step ?? 0) / st.progress.total) * 100) : 0
    const badge = st.status === 'live' ? { text: tr('يعمل', 'Live'), cls: 'bg-[#00FFB2]/15 text-[#00FFB2]' }
        : st.status === 'failed' ? { text: tr('فشل', 'Failed'), cls: 'bg-red-500/15 text-red-300' }
        : st.status === 'suspended' ? { text: tr('موقوف', 'Suspended'), cls: 'bg-amber-500/15 text-amber-300' }
        : { text: tr('جارٍ التجهيز', 'Preparing'), cls: 'bg-white/10 text-white/70' }

    return (
        <div className='flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='text-[10px] font-bold uppercase tracking-[0.2em] text-[#00FFB2]/60'>🛒 {tr('متجر', 'Store')} · {store.tier}</div>
                    <h3 className='mt-1 truncate text-lg font-extrabold'>{store.name}</h3>
                    <a href={st.url} target='_blank' rel='noreferrer' className='block truncate font-mono text-xs text-white/50 hover:text-white' dir='ltr'>{st.url.replace(/^https?:\/\//, '')}</a>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>{badge.text}</span>
            </div>

            {inFlight && (
                <div className='mt-4'>
                    <div className='flex items-center justify-between text-xs text-white/60'>
                        <span>{st.progress?.label || tr('في الانتظار…', 'Queued…')}</span>
                        {st.progress?.total ? <span>{st.progress.step}/{st.progress.total}</span> : null}
                    </div>
                    <div className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10'>
                        <div className='h-full rounded-full bg-[#00FFB2] transition-all duration-500' style={{ width: `${Math.max(6, pct)}%` }} />
                    </div>
                    <p className='mt-2 text-[11px] text-white/40'>{tr('عادةً أقل من دقيقة. هيوصلك إيميل ببيانات الدخول.', 'Usually under a minute. Login details arrive by e-mail.')}</p>
                </div>
            )}

            {st.status === 'failed' && (
                <div className='mt-4 rounded-xl bg-red-500/10 p-3 text-xs text-red-200'>
                    <div className='flex items-center gap-1.5 font-bold'><FiAlertTriangle /> {tr('تعذّر تجهيز المتجر', 'Provisioning failed')}</div>
                    {st.lastError && <p className='mt-1 break-words font-mono text-[11px] text-red-200/80' dir='ltr'>{st.lastError.slice(0, 200)}</p>}
                    <p className='mt-1 text-red-200/70'>{tr('تم إبلاغ الدعم؛ هيتم إعادة المحاولة أو التواصل معك.', 'Support has been notified and will retry or contact you.')}</p>
                </div>
            )}

            {store.validUntil && st.status !== 'failed' && (
                <p className='mt-3 text-xs text-white/50'>{tr('ساري حتى', 'Valid until')} {new Date(store.validUntil).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</p>
            )}

            <div className='mt-auto flex flex-wrap items-center gap-2 pt-4'>
                <a href={st.url} target='_blank' rel='noreferrer'
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition ${st.status === 'live' ? 'bg-[#00FFB2] text-[#0B2923] hover:scale-[1.03]' : 'pointer-events-none bg-white/10 text-white/40'}`}>
                    <FiExternalLink /> {tr('افتح المتجر', 'Open store')}
                </a>
                <a href={`${st.url}/dashboard`} target='_blank' rel='noreferrer'
                    className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${st.status === 'live' || st.status === 'suspended' ? 'border-white/20 text-white/90 hover:bg-white/10' : 'pointer-events-none border-white/10 text-white/30'}`}>
                    <FiSettings /> {tr('لوحة التحكم', 'Dashboard')}
                </a>
                <button type='button' onClick={remove} disabled={busy || inFlight}
                    className='ms-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs text-white/40 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40'>
                    <FiTrash2 /> {tr('حذف', 'Delete')}
                </button>
            </div>
        </div>
    )
}
