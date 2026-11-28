'use client'
// Custom-project price ranges, maintained by sales (FR-S12, US-28). The agent
// quotes ONLY active ranges from here; with no range it offers a quotation instead.
import React, { useCallback, useEffect, useState } from 'react'
import { api, btnGhost, btnPrimary, Card, errorText, fmtDate, inputCls, PageHeader } from '../components/agent/ui'

type Range = {
    category: string; labelAr: string; labelEn: string; minUsd: number; maxUsd: number | null; minEgp: number | null; maxEgp: number | null
    notesAr: string | null; notesEn: string | null; active: boolean; version: number; updatedBy: string; updatedAt: string
}
const EMPTY = { category: '', labelAr: '', labelEn: '', minUsd: '', maxUsd: '', minEgp: '', maxEgp: '', notesAr: '', notesEn: '', active: true, version: 0 }
const fmtRange = (min: number, max: number | null, cur: string) =>
    max == null ? `${cur} from ${min.toLocaleString()}` : `${cur} ${min.toLocaleString()} – ${max.toLocaleString()}`
const SUGGESTED = ['custom_lms', 'lms_mobile_apps', 'ecommerce_app', 'custom_software']

export default function PriceRangesPage() {
    const [items, setItems] = useState<Range[]>([])
    const [form, setForm] = useState<typeof EMPTY | null>(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        const r = await api<{ items: Range[] }>('/api/agent/admin/price-ranges')
        if (!r.ok) return setError(errorText(r))
        setItems(r.data.items)
    }, [])
    useEffect(() => { load() }, [load])

    const edit = (r: Range) => setForm({
        category: r.category, labelAr: r.labelAr, labelEn: r.labelEn, minUsd: String(r.minUsd), maxUsd: r.maxUsd == null ? '' : String(r.maxUsd),
        minEgp: r.minEgp == null ? '' : String(r.minEgp), maxEgp: r.maxEgp == null ? '' : String(r.maxEgp),
        notesAr: r.notesAr ?? '', notesEn: r.notesEn ?? '', active: r.active, version: r.version,
    })

    const save = async () => {
        if (!form) return
        setBusy(true)
        setError('')
        const r = await api(`/api/agent/admin/price-ranges/${encodeURIComponent(form.category.trim())}`, {
            method: 'PUT',
            body: JSON.stringify({
                version: form.version || undefined, labelAr: form.labelAr, labelEn: form.labelEn,
                minUsd: Number(form.minUsd), maxUsd: form.maxUsd === '' ? null : Number(form.maxUsd),
                minEgp: form.minEgp === '' ? null : Number(form.minEgp), maxEgp: form.maxEgp === '' ? null : Number(form.maxEgp),
                notesAr: form.notesAr || null, notesEn: form.notesEn || null, active: form.active,
            }),
        })
        setBusy(false)
        if (!r.ok) return setError(errorText(r))
        setForm(null)
        load()
    }

    const f = form
    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <PageHeader title='Custom-project price ranges' subtitle='نطاقات أسعار المشاريع المخصصة — يقتبسها المساعد كما هي'>
                <button className={btnPrimary} onClick={() => setForm({ ...EMPTY })}>Add range</button>
            </PageHeader>
            <p className='text-sm text-gray-600 max-w-3xl'>
                The AI assistant quotes only the active ranges below, word for word, and always adds that the final quotation depends on scope.
                For a category with no active range it gives no number and offers to connect the visitor with sales.
            </p>
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded'>{error}</div>}

            {f && (
                <Card className='grid md:grid-cols-2 gap-3'>
                    <label className='text-sm'>Category key
                        <input className={inputCls} list='range-categories' disabled={!!f.version} value={f.category} onChange={(e) => setForm({ ...f, category: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder='custom_lms' />
                        <datalist id='range-categories'>{SUGGESTED.map((s) => <option key={s} value={s} />)}</datalist>
                    </label>
                    <label className='text-sm flex items-center gap-2 mt-5'><input type='checkbox' checked={f.active} onChange={(e) => setForm({ ...f, active: e.target.checked })} /> Active (the agent may quote it)</label>
                    <label className='text-sm'>Label (Arabic)<input dir='rtl' className={inputCls} value={f.labelAr} onChange={(e) => setForm({ ...f, labelAr: e.target.value })} /></label>
                    <label className='text-sm'>Label (English)<input className={inputCls} value={f.labelEn} onChange={(e) => setForm({ ...f, labelEn: e.target.value })} /></label>
                    <label className='text-sm'>From (USD)<input type='number' min={0} className={inputCls} value={f.minUsd} onChange={(e) => setForm({ ...f, minUsd: e.target.value })} /></label>
                    <label className='text-sm'>To (USD, empty = “from”)<input type='number' min={0} className={inputCls} value={f.maxUsd} onChange={(e) => setForm({ ...f, maxUsd: e.target.value })} /></label>
                    <label className='text-sm'>From (EGP, optional)<input type='number' min={0} className={inputCls} value={f.minEgp} onChange={(e) => setForm({ ...f, minEgp: e.target.value })} /></label>
                    <label className='text-sm'>To (EGP, empty = “from”)<input type='number' min={0} className={inputCls} value={f.maxEgp} disabled={f.minEgp === ''} onChange={(e) => setForm({ ...f, maxEgp: e.target.value })} /></label>
                    <p className='md:col-span-2 text-xs text-gray-500 -mt-1'>
                        With an EGP range, the assistant quotes EGP to visitors in Egypt and USD to everyone else. Leave EGP empty to quote USD only — amounts are never converted.
                    </p>
                    <label className='text-sm'>What changes the price (Arabic)<textarea dir='rtl' rows={2} className={inputCls} value={f.notesAr} onChange={(e) => setForm({ ...f, notesAr: e.target.value })} /></label>
                    <label className='text-sm'>What changes the price (English)<textarea rows={2} className={inputCls} value={f.notesEn} onChange={(e) => setForm({ ...f, notesEn: e.target.value })} /></label>
                    <div className='md:col-span-2 flex gap-2'>
                        <button className={btnPrimary} disabled={busy || !f.category || !f.labelAr || !f.labelEn || f.minUsd === ''} onClick={save}>Save</button>
                        <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
                    </div>
                </Card>
            )}

            <div className='overflow-auto bg-white rounded-lg shadow-sm'>
                <table className='w-full text-sm text-left text-gray-600'>
                    <thead className='text-xs uppercase bg-gray-50 text-gray-500'>
                        <tr><th className='px-4 py-3'>Category</th><th className='px-4 py-3'>Label</th><th className='px-4 py-3'>Range</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3'>Updated</th><th /></tr>
                    </thead>
                    <tbody>
                        {items.map((r) => (
                            <tr key={r.category} className='border-t'>
                                <td className='px-4 py-3 font-mono'>{r.category}</td>
                                <td className='px-4 py-3'>{r.labelEn}<div className='text-gray-400' dir='rtl'>{r.labelAr}</div></td>
                                <td className='px-4 py-3 whitespace-nowrap'>
                                    {fmtRange(r.minUsd, r.maxUsd, 'USD')}
                                    <div className='text-gray-400'>{r.minEgp == null ? 'EGP: —' : fmtRange(r.minEgp, r.maxEgp, 'EGP')}</div>
                                </td>
                                <td className='px-4 py-3'>{r.active ? 'Active' : <span className='text-gray-400'>Inactive</span>}</td>
                                <td className='px-4 py-3 whitespace-nowrap'>{fmtDate(r.updatedAt)} · v{r.version}</td>
                                <td className='px-4 py-3'><button className={btnGhost} onClick={() => edit(r)}>Edit</button></td>
                            </tr>
                        ))}
                        {!items.length && <tr><td colSpan={6} className='px-4 py-10 text-center text-gray-400'>No ranges yet — until one exists, the agent hands price questions to sales.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
