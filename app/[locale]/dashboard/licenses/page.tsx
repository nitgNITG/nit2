'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { featureDefs, featureLabel, type Product } from '@/lib/licenseFeatures'

type License = {
    id?: string
    key: string
    name: string
    active: boolean
    price: number
    priceEgp: number
    priceEgpMonthly: number
    listPriceEgp: number
    listPriceEgpMonthly: number
    durationDays: number
    maxCourses: number
    maxTeachers: number
    storageGb: number
    supportedApp: boolean
    kashierEnabled: boolean
    contactSales: boolean
    popular: boolean
    videoSource: string
    product: 'academy' | 'store'
    limits: Record<string, number>
    features: Record<string, boolean>
    order: number
}

const VIDEO_SOURCES = ['vimeo', 'vdocipher']
// Feature toggles + their editor tabs live in lib/licenseFeatures.ts (shared with
// the pricing page). Academies: local_license::has_feature; stores: PlatformLicense.
const LIMIT_KEYS = ['quiz', 'video', 'pdf', 'default']
// Store plans: caps enforced by store-api (PlatformLicense).
const STORE_LIMIT_KEYS = ['products', 'staff', 'categories', 'storage_mb']
const STORE_LIMIT_LABELS: Record<string, string> = { products: 'Products', staff: 'Staff accounts', categories: 'Categories', storage_mb: 'Storage (MB)' }

const blank = (product: Product = 'academy'): License => ({
    key: '', name: '', active: true, price: 0, priceEgp: 0, priceEgpMonthly: 0, listPriceEgp: 0, listPriceEgpMonthly: 0, durationDays: 365,
    maxCourses: -1, maxTeachers: -1, storageGb: 1, supportedApp: true, kashierEnabled: false, contactSales: false, popular: false, videoSource: 'vimeo', order: 0,
    product,
    limits: product === 'store' ? { products: -1, staff: -1, categories: -1, storage_mb: -1 } : { quiz: -1, video: -1, pdf: -1, default: -1 },
    features: Object.fromEntries(featureDefs(product).map((f) => [f.key, false])),
})

const cap = (n: number) => (n < 0 ? '∞' : String(n))
const mb = (n?: number) => ((n ?? -1) < 0 ? '∞' : n! >= 1024 ? `${(n! / 1024).toFixed(n! % 1024 ? 1 : 0)} GB` : `${n} MB`)

const LicensesPage = () => {
    const [licenses, setLicenses] = useState<License[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState<License | null>(null)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    // Which product's plans are listed; a new licence starts on the current tab.
    const [tab, setTab] = useState<Product>('academy')

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

    const openNew = () => { setForm(blank(tab)); setEditingKey(null) }
    const openEdit = (l: License) => {
        const b = blank(l.product)
        setForm({ ...b, ...l, limits: { ...b.limits, ...l.limits }, features: { ...b.features, ...l.features } })
        setEditingKey(l.key)
    }
    const isStore = form?.product === 'store'
    const visible = licenses.filter((l) => (l.product ?? 'academy') === tab)
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
                        {tab === 'academy'
                            ? <>Plans academies run on — course/teacher/storage caps, video source and features. The free-academy
                                limit is on <strong>Platform Settings</strong>; assign plans on the <strong>Academies</strong> page.</>
                            : <>Plans stores run on — product/staff/category/storage caps and features enforced inside each store.
                                The free-store limit is on <strong>Platform Settings → Stores</strong>; assign plans on the <strong>Stores</strong> page.</>}
                    </p>
                    <div className='mt-3 inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm font-semibold'>
                        {([['academy', '🎓 Academies'], ['store', '🛒 Stores']] as [Product, string][]).map(([p, label]) => (
                            <button key={p} type='button' onClick={() => setTab(p)}
                                className={`rounded-md px-4 py-1.5 ${tab === p ? 'bg-[#1E7D67] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                                {label} <span className='opacity-60'>({licenses.filter((l) => (l.product ?? 'academy') === p).length})</span>
                            </button>
                        ))}
                    </div>
                </div>
                <button onClick={openNew}
                    className='shrink-0 bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-5 py-2 rounded-md'>
                    + New {tab === 'store' ? 'store' : 'academy'} licence
                </button>
            </div>

            {/* Editor */}
            {form && (
                <form onSubmit={save} className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5'>
                    <h5 className='font-bold text-lg'>{isStore ? '🛒' : '🎓'} {editingKey ? `Edit "${editingKey}"` : `New ${isStore ? 'store' : 'academy'} licence`}</h5>

                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Key <span className='text-red-400'>*</span></label>
                            <input className='w-full border rounded-lg px-3 py-2 font-mono text-sm disabled:bg-gray-100'
                                value={form.key} disabled={!!editingKey}
                                onChange={(e) => setForm((f) => f ? { ...f, key: e.target.value } : f)} placeholder='enterprise' />
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Name <span className='text-red-400'>*</span></label>
                            <select className='mb-2 w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100' value={form.product} disabled={!!editingKey}
                                title='Which product this plan is sold for. Store plans use the store caps/features below.'
                                onChange={(e) => { const p: Product = e.target.value === 'store' ? 'store' : 'academy'; setForm((f) => f ? { ...blank(p), key: f.key, name: f.name, priceEgp: f.priceEgp, priceEgpMonthly: f.priceEgpMonthly, listPriceEgp: f.listPriceEgp, listPriceEgpMonthly: f.listPriceEgpMonthly, durationDays: f.durationDays } : f) }}>
                                <option value='academy'>🎓 Academy plan</option>
                                <option value='store'>🛒 Store plan</option>
                            </select>
                            <input className='w-full border rounded-lg px-3 py-2' value={form.name}
                                onChange={(e) => setForm((f) => f ? { ...f, name: e.target.value } : f)} placeholder='Enterprise' />
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Annual charge (EGP)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.priceEgp} onChange={num('priceEgp')} />
                            <p className='text-xs text-gray-400 mt-1'>Yearly Kashier charge (term = Duration below). <span className='font-mono'>0</span> = free (no payment).</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Monthly charge (EGP)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.priceEgpMonthly} onChange={num('priceEgpMonthly')} />
                            <p className='text-xs text-gray-400 mt-1'>Optional monthly option (30-day term). <span className='font-mono'>0</span> = annual only.</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Regular annual price (EGP)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.listPriceEgp} onChange={num('listPriceEgp')} />
                            <p className='text-xs text-gray-400 mt-1'>Shown struck-through with a “% off” badge when higher than the annual charge. <span className='font-mono'>0</span> = no discount shown.</p>
                        </div>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Regular monthly price (EGP)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.listPriceEgpMonthly} onChange={num('listPriceEgpMonthly')} />
                            <p className='text-xs text-gray-400 mt-1'>Strikethrough for the monthly price. <span className='font-mono'>0</span> = none.</p>
                        </div>
                    </div>

                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Duration (days)</label>
                            <input type='number' min={0} className='w-full border rounded-lg px-3 py-2' value={form.durationDays} onChange={num('durationDays')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>0 = never expires</p>
                        </div>
                        {!isStore && <>
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
                            <input type='number' min={-1} className='w-full border rounded-lg px-3 py-2' value={form.storageGb} onChange={num('storageGb')} />
                            <p className='text-[11px] text-gray-400 mt-0.5'>moodledata quota per academy · -1 = unlimited (off-server hosting)</p>
                        </div>
                        </>}
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        {!isStore && (
                        <div>
                            <label className='block text-sm font-semibold mb-1'>Video source</label>
                            <select className='w-full border rounded-lg px-3 py-2' value={form.videoSource}
                                onChange={(e) => setForm((f) => f ? { ...f, videoSource: e.target.value } : f)}>
                                {VIDEO_SOURCES.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        )}
                        <div className='flex items-end gap-4 flex-wrap'>
                            <label className='flex items-center gap-2 text-sm font-semibold'>
                                <input type='checkbox' checked={form.active} onChange={(e) => setForm((f) => f ? { ...f, active: e.target.checked } : f)} />
                                Active (offered on the build form)
                            </label>
                            {!isStore && <>
                            <label className='flex items-center gap-2 text-sm font-semibold' title='When off, academies on this licence are refused by the mobile app at onboarding (design_system site.supportedapp=false). Use for Demo.'>
                                <input type='checkbox' checked={form.supportedApp} onChange={(e) => setForm((f) => f ? { ...f, supportedApp: e.target.checked } : f)} />
                                App access
                            </label>
                            <label className='flex items-center gap-2 text-sm font-semibold' title='Push the shared Kashier payment gateway to academies on this licence (credentials set in Platform Settings → Integrations).'>
                                <input type='checkbox' checked={form.kashierEnabled} onChange={(e) => setForm((f) => f ? { ...f, kashierEnabled: e.target.checked } : f)} />
                                Kashier payments
                            </label>
                            </>}
                            <label className='flex items-center gap-2 text-sm font-semibold' title='Show this plan with a “Contact us” button instead of a price, and refuse any direct purchase. For custom / quote-based tiers (e.g. Professional / Enterprise).'>
                                <input type='checkbox' checked={form.contactSales} onChange={(e) => setForm((f) => f ? { ...f, contactSales: e.target.checked } : f)} />
                                Contact sales (not buyable)
                            </label>
                            <label className='flex items-center gap-2 text-sm font-semibold' title='Highlight this plan as “Most popular” on the public pricing page.'>
                                <input type='checkbox' checked={form.popular} onChange={(e) => setForm((f) => f ? { ...f, popular: e.target.checked } : f)} />
                                Highlight as popular
                            </label>
                        </div>
                    </div>

                    {/* Activity limits */}
                    <div>
                        <p className='text-sm font-semibold mb-2'>{isStore ? 'Store caps' : 'Activity caps'} <span className='font-normal text-gray-400 text-xs'>(-1 = unlimited)</span></p>
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                            {(isStore ? STORE_LIMIT_KEYS : LIMIT_KEYS).map((k) => (
                                <div key={k}>
                                    <label className='block text-xs text-gray-500 mb-1 capitalize'>{isStore ? STORE_LIMIT_LABELS[k] : k.replace('_', ' ')}</label>
                                    <input type='number' className='w-full border rounded-lg px-3 py-1.5 text-sm'
                                        value={form.limits[k] ?? -1}
                                        onChange={(e) => setForm((f) => f ? { ...f, limits: { ...f.limits, [k]: Number(e.target.value) } } : f)} />
                                    {k === 'video' && <p className='text-[10px] text-gray-400 mt-0.5'>total videos per academy (uploaded to our providers)</p>}
                                </div>
                            ))}
                        </div>
                        {isStore
                            ? <p className='text-[11px] text-gray-400 mt-1'>Products / staff / categories are totals per store; storage caps uploads in MB (-1 = unlimited).</p>
                            : <p className='text-[11px] text-gray-400 mt-1'>quiz / pdf / default are per-course; <strong>video</strong> is a per-academy total (blocks new provider uploads at the limit).</p>}
                    </div>

                    {/* Features — one flat list of toggles; store keys are enforced by
                        store-api (requireFeature), academy keys by local_license. */}
                    <div>
                        <p className='text-sm font-semibold mb-2'>Features</p>
                        <div className='grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-gray-200 p-4 md:grid-cols-3'>
                            {featureDefs(form.product).map((f) => (
                                <label key={f.key} className='flex items-center gap-2 text-sm'>
                                    <input type='checkbox' checked={!!form.features[f.key]}
                                        onChange={(e) => setForm((prev) => prev ? { ...prev, features: { ...prev.features, [f.key]: e.target.checked } } : prev)} />
                                    {f.label.en}
                                    {f.pending && <span className='rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700' title='Stored and pushed now; the app starts enforcing it once its module gates on this key.'>soon</span>}
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
                    {visible.length === 0 && <p className='text-gray-400 text-sm'>No {tab} licences yet.</p>}
                    {visible.map((l) => (
                        <div key={l.key} className={`bg-white rounded-xl border shadow-sm p-5 space-y-2 ${l.active ? '' : 'opacity-60'}`}>
                            <div className='flex items-start justify-between'>
                                <div>
                                    <p className='font-bold text-lg'>{l.product === 'store' ? '🛒 ' : '🎓 '}{l.name}</p>
                                    <p className='text-xs text-gray-400 font-mono'>{l.key} · <span className='uppercase'>{l.product === 'store' ? 'store' : 'academy'}</span>{!l.active && ' · inactive'}</p>
                                </div>
                                <span className='text-[#268F79] font-bold text-right'>
                                    {(l.priceEgp ?? 0) === 0 ? 'Free' : `${l.priceEgp} EGP/yr`}
                                    {(l.priceEgpMonthly ?? 0) > 0 && (
                                        <span className='block text-xs font-semibold text-[#268F79]/70'>{l.priceEgpMonthly} EGP/mo</span>
                                    )}
                                </span>
                            </div>
                            <ul className='text-xs text-gray-600 space-y-0.5'>
                                {l.product === 'store' ? <>
                                    <li>Products: <b>{cap(l.limits?.products ?? -1)}</b> · Staff: <b>{cap(l.limits?.staff ?? -1)}</b> · Categories: <b>{cap(l.limits?.categories ?? -1)}</b></li>
                                    <li>Storage: <b>{mb(l.limits?.storage_mb)}</b> · {l.durationDays === 0 ? 'no expiry' : `${l.durationDays}d`}</li>
                                </> : <>
                                    <li>Courses: <b>{cap(l.maxCourses)}</b> · Teachers: <b>{cap(l.maxTeachers)}</b> · Storage: <b>{(l.storageGb ?? 1) < 0 ? '∞' : `${l.storageGb ?? 1} GB`}</b></li>
                                    <li>Video: <b>{l.videoSource}</b> · {l.durationDays === 0 ? 'no expiry' : `${l.durationDays}d`} · App: <b>{l.supportedApp === false ? 'no' : 'yes'}</b></li>
                                </>}
                                <li className='truncate'>Features: <b>{Object.keys(l.features ?? {}).filter((f) => l.features?.[f]).map((f) => featureLabel(l.product ?? 'academy', f)).join(', ') || 'none'}</b></li>
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
