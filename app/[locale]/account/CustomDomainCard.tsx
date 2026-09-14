'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import axios from 'axios'
import toast from 'react-hot-toast'

type Instruction = {
    apex: boolean
    record: { type: 'A' | 'CNAME'; host: string; value: string }
    aRecordValue: string
    cnameValue: string
    note: string
}
type DomainView = {
    customDomain: string | null
    domainStatus: 'none' | 'pending_dns' | 'verifying' | 'active' | 'failed'
    domainError: string | null
    baseDomain: string
    subdomain: string
    apex: boolean | null
    instructions: Instruction | null
}

// Owner self-serve custom-domain binding for one academy. Talks to
// /api/academies/<slug>/domain (GET/POST/PUT/DELETE). Styled to match the
// account card theme (dark-green text on a light surface, #1E7D67 accents).
export default function CustomDomainCard({ slug }: { slug: string }) {
    const isAr = useLocale() === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)

    const [view, setView] = useState<DomainView | null>(null)
    const [input, setInput] = useState('')
    const [busy, setBusy] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/academies/${slug}/domain`)
            setView(data)
            if (data.customDomain && !input) setInput(data.customDomain)
        } catch { /* keep prior */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug])

    useEffect(() => { load() }, [load])

    // While a bind is in flight, poll (the GET syncs server B's result into the DB).
    useEffect(() => {
        if (view?.domainStatus === 'verifying' && !pollRef.current) {
            pollRef.current = setInterval(load, 5000)
        }
        if (view?.domainStatus !== 'verifying' && pollRef.current) {
            clearInterval(pollRef.current); pollRef.current = null
        }
        return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
    }, [view?.domainStatus, load])

    const save = async () => {
        setBusy(true)
        try {
            const { data } = await axios.post(`/api/academies/${slug}/domain`, { domain: input })
            setView(data)
            toast.success(tr('تم الحفظ — أضف سجل DNS التالي', 'Saved — add the DNS record below'))
        } catch (e: any) {
            toast.error(e?.response?.data?.error || tr('تعذّر الحفظ', 'Could not save'))
        } finally { setBusy(false) }
    }

    const verify = async () => {
        setBusy(true)
        try {
            const { data } = await axios.put(`/api/academies/${slug}/domain`)
            setView(data)
            toast.success(tr('جارٍ التفعيل وإصدار الشهادة…', 'Verifying & issuing certificate…'))
        } catch (e: any) {
            const d = e?.response?.data
            setView((v) => (d && d.domainStatus ? { ...(v as DomainView), ...d } : v))
            toast.error(d?.dns?.detail || d?.error || tr('DNS غير موجّه بعد', 'DNS isn’t pointing here yet'))
        } finally { setBusy(false) }
    }

    const remove = async () => {
        if (!confirm(tr('إزالة الدومين والعودة للنطاق الفرعي؟', 'Remove the domain and revert to the subdomain?'))) return
        setBusy(true)
        try {
            const { data } = await axios.delete(`/api/academies/${slug}/domain`)
            setView(data); setInput('')
            toast.success(tr('تمت الإزالة', 'Removed'))
        } catch (e: any) {
            toast.error(e?.response?.data?.error || tr('تعذّرت الإزالة', 'Could not remove'))
        } finally { setBusy(false) }
    }

    if (!view) return null
    const st = view.domainStatus
    const ins = view.instructions

    const pill =
        st === 'active' ? 'bg-[#1E7D67]/12 text-[#0b8f66]'
        : st === 'verifying' ? 'bg-[#E8A13C]/15 text-[#b9791f]'
        : st === 'failed' ? 'bg-red-500/10 text-red-600'
        : 'bg-black/5 text-[#0B2923]/60'

    return (
        <div className='rounded-xl bg-white ring-1 ring-black/5 p-4 space-y-3 text-[#0B2923]'>
            <div className='flex items-center justify-between gap-3'>
                <h4 className='font-bold'>🌐 {tr('دومين مخصّص', 'Custom domain')}</h4>
                {st !== 'none' && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill}`}>
                        {st === 'active' ? tr('● نشط', '● live')
                            : st === 'verifying' ? tr('◐ جارٍ التفعيل', '◐ activating')
                            : st === 'failed' ? tr('✗ فشل', '✗ failed')
                            : tr('بانتظار DNS', 'awaiting DNS')}
                    </span>
                )}
            </div>

            <p className='text-xs text-[#0B2923]/60'>
                {tr('اربط أكاديميتك بدومينك الخاص. سيصبح هو العنوان الرسمي، ويحوّل النطاق الفرعي إليه تلقائياً.',
                    'Point your own domain at your academy. It becomes the canonical address, and your subdomain redirects to it.')}
                {' '}<span className='font-mono text-[#0B2923]/40'>{view.subdomain}</span>
            </p>

            {st === 'active' && view.customDomain ? (
                <div className='flex items-center justify-between gap-3'>
                    <a href={`https://${view.customDomain}`} target='_blank' rel='noreferrer'
                        className='font-mono text-sm text-[#0b8f66] font-semibold break-all hover:underline'>
                        https://{view.customDomain}
                    </a>
                    <button onClick={remove} disabled={busy} className='text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg px-2 py-1 disabled:opacity-60'>
                        {tr('إزالة', 'Remove')}
                    </button>
                </div>
            ) : (
                <div className='flex gap-2'>
                    <input value={input} onChange={(e) => setInput(e.target.value)}
                        placeholder='academy.yourschool.com'
                        className='flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-mono text-[#0B2923] placeholder:text-[#0B2923]/30 outline-none focus:border-[#1E7D67]' />
                    <button onClick={save} disabled={busy || !input.trim()}
                        className='rounded-lg bg-[#1E7D67] px-4 text-sm font-bold text-white hover:bg-[#186655] disabled:opacity-50 transition-colors'>
                        {tr('حفظ', 'Save')}
                    </button>
                </div>
            )}

            {/* DNS instructions once a domain is set but not yet active */}
            {ins && (st === 'pending_dns' || st === 'failed') && (
                <div className='rounded-lg bg-[#F5F3EE] border border-black/10 p-3 space-y-2 text-sm'>
                    <p className='font-semibold'>{tr('١) أضف هذا السجل عند مزوّد الدومين:', '1) Add this record at your domain provider:')}</p>
                    <div className='font-mono text-xs bg-white border border-black/10 rounded p-2 space-y-0.5'>
                        <div>{tr('النوع', 'Type')}: <b>{ins.record.type}</b></div>
                        <div>{tr('الاسم', 'Host')}: <b>{ins.record.host}</b></div>
                        <div>{tr('القيمة', 'Value')}: <b className='break-all'>{ins.record.value}</b></div>
                    </div>
                    <p className='text-xs text-[#0B2923]/60'>{ins.note}
                        {!ins.apex && ins.aRecordValue &&
                            <> {' '}{tr('أو سجل A إلى', 'or an A record to')} <b className='font-mono'>{ins.aRecordValue}</b>.</>}
                    </p>
                    <p className='font-semibold'>{tr('٢) ثم فعِّل:', '2) Then activate:')}</p>
                    <button onClick={verify} disabled={busy}
                        className='rounded-lg bg-[#1E7D67] px-4 py-2 text-sm font-bold text-white hover:bg-[#186655] disabled:opacity-60 transition-colors'>
                        {tr('أضفتُ السجل — تحقّق وفعِّل', 'I’ve added it — verify & activate')}
                    </button>
                    {st === 'failed' && view.domainError && (
                        <p className='text-xs text-red-600'>{view.domainError}</p>
                    )}
                </div>
            )}

            {st === 'verifying' && (
                <p className='text-xs text-[#b9791f]'>
                    {tr('جارٍ التحقّق من DNS وإصدار شهادة SSL… قد يستغرق دقيقة.',
                        'Verifying DNS and issuing the SSL certificate… this can take a minute.')}
                </p>
            )}
        </div>
    )
}
