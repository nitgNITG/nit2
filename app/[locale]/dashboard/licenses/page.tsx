'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

type License = {
    id?: string
    key: string
    name: string
    active: boolean
    price: number
    priceEgp: number
    durationDays: number
    maxCourses: number
    maxTeachers: number
    storageGb: number
    videoSource: string
    limits: Record<string, number>
    features: Record<string, boolean>
    order: number
}

const VIDEO_SOURCES = ['all', 'limited', 'youtube', 'vimeo', 'vdocipher']
const FEATURE_KEYS = ['drm', 'coupons', 'offers', 'subscriptions', 'packages', 'jitsi']
const LIMIT_KEYS = ['quiz', 'video', 'pdf', 'default']

const blank = (): License => ({
    key: '', name: '', active: true, price: 0, priceEgp: 0, durationDays: 365,
    maxCourses: -1, maxTeachers: -1, storageGb: 1, videoSource: 'all', order: 0,
    limits: { quiz: -1, video: -1, pdf: -1, default: -1 },
    features: Object.fromEntries(FEATURE_KEYS.map((f) => [f, false])),
})

const cap = (n: number) => (n < 0 ? '∞' : String(n))

const LicensesPage = () => {
    const [licenses, setLicenses] = useState<License[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<License | null>(null)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/licenses')
            setLicenses(data.licenses ?? [])
        } catch {
            toast.error('Could not load licences')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const openNew = () => { setForm(blank()); setEditingKey(null) }
    const openEdit = (l: License) => {
        setForm({ ...blank(), ...l, limits: { ...blank().limits, ...l.limits }, features: { ...blank().features, ...l.features } })
        setEditingKey(l.key)
    }
    const close = () => { setForm(null); setEditingKey(null) }

    const num = (k: keyof License) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => (f ? { ...f, [k]: Number(e.target.value) } : f))

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form) return
        setSaving(true)
        try {
            if (editingKey) {
                await axios.put(`/api/licenses/${editingKey}`, form)
                toast.success('Licence updated')
            } else {
                await axios.post('/api/licenses', form)
                toast.success('Licence created')
            }
            close()
            load()
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const remove = async (key: string) => {
        if (!window.confirm(`Delete licence "${key}"?`)) return
        try {
            await axios.delete(`/api/licenses/${key}`)
            toast.success('Deleted')
            setLicenses((l) => l.filter((x) => x.key !== key))
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Delete failed')
        }
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>🎫 Licenses</h4>
                    <p className='text-sm text-gray-500 mt-1 max-w-2xl'>
                        Define the licences (packages) academies run on — limits and features. The free-academy limit per
                        client is set on <strong>Platform Settings</strong>. Manage which academy is on which licence on the
                        <strong> Academies</strong> page.
                    </p>
                </div>
                <button onClick={openNew}
                    className='shrink-0 bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-5 py-2 rounded-md'>
                    + New licence
                </button>
            </div>

            {/* Editor */}
            {form && (
                <form onSubmit={save} className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5'>
                    <h5 className='font-bold text-lg'>{editingKey ? `Edit "${editingKey}"` : 'New licence'}</h5>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Key <span className='text-red-400'>*</span></label>
                            <input className='w-full border rounded-lg px-3 py-2 font-mono text-sm disabled:bg-gray-100'
                                value={form.key} disabled={!!editingKey}
                                onChange={(e) => setForm((f) => f ? { ...f, key: e.target.value } : f)} placeholder='enterprise' />
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Name <span className='text-red-400'>*</span></label>
                            <input className='w-full border rounded-lg px-3 py-2' value={form.name}
                                onChange={(e) => setForm((f) => f ? { ...f, name: e.target.value } : f)} placeholder='Enterprise' />
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Charge (EGP)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.priceEgp} onChange={num('priceEgp')} />
                            <p className='text-xs text-gray-400 mt-1'>Actual Kashier charge. <span className='font-mono'>0</span> = free (no payment).</p>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Duration (days)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.durationDays} onChange={num('durationDays')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>0 = never expires</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Max courses</label>
                            <input type='number' className='w-full border rounded-lg px-3 py-2' value={form.maxCourses} onChange={num('maxCourses')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>-1 = unlimited</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Max teachers</label>
                            <input type='number' className='w-full border rounded-lg px-3 py-2' value={form.maxTeachers} onChange={num('maxTeachers')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>-1 = unlimited</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Storage (GB)</label>
                            <input type='number' min={1} className='w-full border rounded-lg px-3 py-2' value={form.storageGb} onChange={num('storageGb')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>moodledata quota per academy</p>
                        </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Video source</label>
                            <select className='w-full border rounded-lg px-3 py-2' value={form.videoSource}
                                onChange={(e) => setForm((f) => f ? { ...f, videoSource: e.target.value } : f)}>
                                {VIDEO_SOURCES.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className='flex items-end gap-4'>
                            <label className='flex items-center gap-2 text-sm font-semibold'>
                                <input type='checkbox' checked={form.active} onChange={(e) => setForm((f) => f ? { ...f, active: e.target.checked } : f)} />
                                Active (offered on the build form)
                            </label>
                        </div>
                    </div>

                    {/* Per-activity limits */}
                    <div>
                        <p className='text-sm font-semibold mb-2'>Per-course activity caps <span className='font-normal text-gray-400 text-xs'>(-1 = unlimited)</span></p>
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                            {LIMIT_KEYS.map((k) => (
                                <div key={k}>
                                    <label className='block text-xs text-gray-500 mb-1 capitalize'>{k}</label>
                                    <input type='number' className='w-full border rounded-lg px-3 py-1.5 text-sm'
                                        value={form.limits[k] ?? -1}
                                        onChange={(e) => setForm((f) => f ? { ...f, limits: { ...f.limits, [k]: Number(e.target.value) } } : f)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <p className='text-sm font-semibold mb-2'>Features</p>
                        <div className='flex flex-wrap gap-4'>
                            {FEATURE_KEYS.map((f) => (
                                <label key={f} className='flex items-center gap-2 text-sm capitalize'>
                                    <input type='checkbox' checked={!!form.features[f]}
                                        onChange={(e) => setForm((prev) => prev ? { ...prev, features: { ...prev.features, [f]: e.target.checked } } : prev)} />
                                    {f}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className='flex gap-3 pt-2'>
                        <button type='submit' disabled={saving}
                            className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-6 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : editingKey ? 'Update licence' : 'Create licence'}
                        </button>
                        <button type='button' onClick={close} className='border border-gray-300 px-6 py-2 rounded-md text-gray-600 hover:bg-gray-50'>Cancel</button>
                    </div>
                </form>
            )}

            {/* List */}
            {loading ? (
                <p className='text-gray-400'>Loading…</p>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {licenses.map((l) => (
                        <div key={l.key} className={`bg-white rounded-xl border shadow-sm p-5 space-y-2 ${l.active ? '' : 'opacity-60'}`}>
                            <div className='flex items-start justify-between'>
                                <div>
                                    <p className='font-bold text-lg'>{l.name}</p>
                                    <p className='text-xs text-gray-400 font-mono'>{l.key}</p>
                                </div>
                                <span className='text-[#268F79] font-bold'>{(l.priceEgp ?? 0) === 0 ? 'Free' : `${l.priceEgp} EGP`}</span>
                            </div>
                            <ul className='text-xs text-gray-600 space-y-0.5'>
                                <li>Courses: <b>{cap(l.maxCourses)}</b> · Teachers: <b>{cap(l.maxTeachers)}</b> · Storage: <b>{l.storageGb ?? 1} GB</b></li>
                                <li>Video: <b>{l.videoSource}</b> · {l.durationDays === 0 ? 'no expiry' : `${l.durationDays}d`}</li>
                                <li className='truncate'>Features: <b>{FEATURE_KEYS.filter((f) => l.features?.[f]).join(', ') || 'none'}</b></li>
                            </ul>
                            <div className='flex gap-2 pt-2 border-t'>
                                <button onClick={() => openEdit(l)} className='flex-1 text-sm border rounded-lg py-1.5 hover:bg-gray-50'>Edit</button>
                                <button onClick={() => remove(l.key)} className='text-red-400 hover:text-red-600 border border-red-200 rounded-lg px-3 py-1.5 text-sm hover:bg-red-50'>🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default LicensesPage
