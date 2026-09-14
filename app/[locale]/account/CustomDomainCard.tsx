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
// /api/academies/<slug>/domain (GET/POST/PUT/DELETE).
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

    return (
        <div className='rounded-xl border border-gray-200 p-4 space-y-3'>
            <div className='flex items-center justify-between gap-3'>
                <h4 className='font-bold'>{tr('دومين مخصّص', 'Custom domain')}</h4>
                {st === 'active' && <span className='text-xs font-semibold text-emerald-600'>● {tr('نشط', 'Active')}</span>}
                {st === 'verifying' && <span className='text-xs font-semibold text-amber-600'>◐ {tr('جارٍ التفعيل', 'Activating…')}</span>}
                {(st === 'pending_dns' || st === 'failed') && <span className='text-xs font-semibold text-gray-500'>{tr('بانتظار DNS', 'Awaiting DNS')}</span>}
            </div>

            <p className='text-xs text-gray-500'>
                {tr('اربط أكاديميتك بدومينك الخاص. سيصبح هو العنوان الرسمي، ويحوّل النطاق الفرعي إليه تلقائياً.',
                    'Point your own domain at your academy. It becomes the canonical address, and your subdomain redirects to it.')}
                {' '}<span className='font-mono text-gray-400'>{view.subdomain}</span>
            </p>

            {st === 'active' && view.customDomain ? (
                <div className='flex items-center justify-between gap-3'>
                    <a href={`https://${view.customDomain}`} target='_blank' rel='noreferrer'
                        className='font-mono text-sm text-blue-600 break-all'>https://{view.customDomain}</a>
                    <button onClick={remove} disabled={busy} className='text-xs text-red-500 font-semibold disabled:opacity-50'>
                        {tr('إزالة', 'Remove')}
                    </button>
                </div>
            ) : (
                <div className='flex gap-2'>
                    <input value={input} onChange={(e) => setInput(e.target.value)}
                        placeholder='academy.yourschool.com'
                        className='flex-1 border-2 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-500' />
                    <button onClick={save} disabled={busy || !input.trim()}
                        className='bg-blue-600 text-white px-4 rounded-lg text-sm font-bold disabled:opacity-50'>
                        {tr('حفظ', 'Save')}
                    </button>
                </div>
            )}

            {/* DNS instructions once a domain is set but not yet active */}
            {ins && (st === 'pending_dns' || st === 'failed') && (
                <div className='rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2 text-sm'>
                    <p className='font-semibold'>{tr('١) أضف هذا السجل عند مزوّد الدومين:', '1) Add this record at your domain provider:')}</p>
                    <div className='font-mono text-xs bg-white border rounded p-2'>
                        <div>{tr('النوع', 'Type')}: <b>{ins.record.type}</b></div>
                        <div>{tr('الاسم', 'Host')}: <b>{ins.record.host}</b></div>
                        <div>{tr('القيمة', 'Value')}: <b className='break-all'>{ins.record.value}</b></div>
                    </div>
                    <p className='text-xs text-gray-500'>{ins.note}
                        {!ins.apex && ins.aRecordValue &&
                            <> {' '}{tr('أو سجل A إلى', 'or an A record to')} <b className='font-mono'>{ins.aRecordValue}</b>.</>}
                    </p>
                    <p className='font-semibold'>{tr('٢) ثم فعِّل:', '2) Then activate:')}</p>
                    <button onClick={verify} disabled={busy}
                        className='bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50'>
                        {tr('أضفتُ السجل — تحقّق وفعِّل', 'I’ve added it — verify & activate')}
                    </button>
                    {st === 'failed' && view.domainError && (
                        <p className='text-xs text-red-500'>{view.domainError}</p>
                    )}
                </div>
            )}

            {st === 'verifying' && (
                <p className='text-xs text-amber-600'>
                    {tr('جارٍ التحقّق من DNS وإصدار شهادة SSL… قد يستغرق دقيقة.',
                        'Verifying DNS and issuing the SSL certificate… this can take a minute.')}
                </p>
            )}
        </div>
    )
}
