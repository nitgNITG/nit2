'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

// Mirror of local_license::TIERS (saas-demo) — reference only; the Moodle plugin
// is the source of truth for enforcement.
const TIERS = [
    { key: 'demo', name: 'Demo', color: 'bg-gray-100 text-gray-600', blurb: '1 course · 1 teacher · limited video · 14 days' },
    { key: 'basic', name: 'Basic', color: 'bg-blue-50 text-blue-700', blurb: '3 courses · 1 teacher · YouTube · 1 year' },
    { key: 'standard', name: 'Standard', color: 'bg-amber-50 text-amber-700', blurb: '10 courses · unlimited teachers · Vimeo' },
    { key: 'professional', name: 'Professional', color: 'bg-emerald-50 text-emerald-700', blurb: 'Unlimited · VdoCipher DRM · coupons, subscriptions, packages, jitsi' },
] as const

const TIER_KEYS = TIERS.map((t) => t.key)
const tierMeta = (k: string) => TIERS.find((t) => t.key === k) ?? TIERS[0]

type Academy = { id: string; name: string; slug: string; status: string; tier: string }

const LicensesPage = () => {
    const [academies, setAcademies] = useState<Academy[]>([])
    const [loading, setLoading] = useState(true)
    const [savingSlug, setSavingSlug] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/academies')
            setAcademies(data.academies ?? [])
        } catch {
            toast.error('Could not load academies')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const changeTier = async (slug: string, tier: string) => {
        const prev = academies
        setSavingSlug(slug)
        setAcademies((list) => list.map((a) => (a.slug === slug ? { ...a, tier } : a)))
        try {
            await axios.patch(`/api/academies/${slug}`, { tier })
            toast.success(`${slug} → ${tierMeta(tier).name} (re-applying to the site…)`)
        } catch (err: any) {
            setAcademies(prev) // rollback
            toast.error(err?.response?.data?.error || 'Failed to change plan')
        } finally {
            setSavingSlug(null)
        }
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>🎫 Licenses</h4>
                <p className='text-sm text-gray-500 mt-1 max-w-2xl'>
                    Each academy runs on a plan (local_license tier). Changing it here updates the control plane and
                    re-applies the licence to the live Moodle. New academies get the plan the client picked at build time.
                </p>
            </div>

            {/* Tier reference */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                {TIERS.map((t) => (
                    <div key={t.key} className='bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${t.color}`}>{t.name}</span>
                        <p className='text-xs text-gray-500 mt-2 leading-relaxed'>{t.blurb}</p>
                    </div>
                ))}
            </div>

            {/* Academies */}
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-50 text-left text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 font-semibold'>Academy</th>
                            <th className='px-4 py-3 font-semibold'>Status</th>
                            <th className='px-4 py-3 font-semibold'>Current plan</th>
                            <th className='px-4 py-3 font-semibold'>Change plan</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                        {loading ? (
                            <tr><td colSpan={4} className='px-4 py-10 text-center text-gray-400'>Loading…</td></tr>
                        ) : academies.length === 0 ? (
                            <tr><td colSpan={4} className='px-4 py-10 text-center text-gray-400'>No academies yet.</td></tr>
                        ) : academies.map((a) => (
                            <tr key={a.id} className='hover:bg-gray-50'>
                                <td className='px-4 py-3'>
                                    <div className='font-semibold text-gray-900'>{a.name}</div>
                                    <div className='text-xs text-gray-400 font-mono'>{a.slug}</div>
                                </td>
                                <td className='px-4 py-3 text-gray-500'>{a.status}</td>
                                <td className='px-4 py-3'>
                                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tierMeta(a.tier).color}`}>
                                        {tierMeta(a.tier).name}
                                    </span>
                                </td>
                                <td className='px-4 py-3'>
                                    <select
                                        className='border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50'
                                        value={a.tier}
                                        disabled={savingSlug === a.slug}
                                        onChange={(e) => changeTier(a.slug, e.target.value)}
                                    >
                                        {TIER_KEYS.map((k) => (
                                            <option key={k} value={k}>{tierMeta(k).name}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default LicensesPage
