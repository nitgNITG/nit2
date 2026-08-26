'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import BuildProductForm from '../../build-product/BuildProductForm'

type Academy = { id: string; name: string; slug: string; status: string; tier: string }
type License = { key: string; name: string; active: boolean }

const AcademiesPage = () => {
    const [academies, setAcademies] = useState<Academy[]>([])
    const [licenses, setLicenses] = useState<License[]>([])
    const [loading, setLoading] = useState(true)
    const [savingSlug, setSavingSlug] = useState<string | null>(null)
    const [updatingAll, setUpdatingAll] = useState(false)
    const [busySlug, setBusySlug] = useState<string | null>(null)
    const [brandingSlug, setBrandingSlug] = useState<string | null>(null)

    const licenseName = (key: string) => licenses.find((l) => l.key === key)?.name ?? key

    // Each academy's Google OAuth redirect URI must be added to the Web OAuth
    // client's "Authorized redirect URIs" in the Google Cloud Console (Google
    // has no API/wildcard for this). Domain matches provisioning/create.sh.
    const ACADEMY_DOMAIN = 'academy2026.nitg-eg.com'
    const GOOGLE_CONSOLE_URL =
        'https://console.cloud.google.com/auth/clients/31169484251-lkhbei8fv9eq6tc03u498569l9jobj9r.apps.googleusercontent.com?authuser=1&project=new-academy-504912'
    const redirectUri = (slug: string) => `https://${slug}.${ACADEMY_DOMAIN}/admin/oauth2callback.php`
    const copyRedirect = async (slug: string) => {
        const url = redirectUri(slug)
        try {
            await navigator.clipboard.writeText(url)
            toast.success('Redirect URI copied — paste it into Google Cloud → Authorized redirect URIs')
        } catch {
            // Clipboard API can fail (insecure context / permissions) — show it to copy by hand.
            window.prompt('Copy this redirect URI into Google Cloud → Authorized redirect URIs:', url)
        }
    }

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [a, l] = await Promise.all([axios.get('/api/academies'), axios.get('/api/licenses')])
            setAcademies(a.data.academies ?? [])
            setLicenses(l.data.licenses ?? [])
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
            toast.success(`${slug} → ${licenseName(tier)} (re-applying to the site…)`)
        } catch (err: any) {
            setAcademies(prev)
            toast.error(err?.response?.data?.error || 'Failed to change licence')
        } finally {
            setSavingSlug(null)
        }
    }

    // Recreate EVERY live academy onto the latest baked image (the baked
    // equivalent of "pull latest code" — data is preserved).
    const updateAll = async () => {
        if (!window.confirm('Update every live academy onto the latest image now? Each restarts for ~30s; data is preserved.')) return
        setUpdatingAll(true)
        try {
            const { data } = await axios.post('/api/academies/update-images')
            toast.success(`Update queued for ${data.queued}/${data.academies} academies`)
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Update failed')
        } finally {
            setUpdatingAll(false)
        }
    }

    const updateImage = async (slug: string) => {
        if (!window.confirm(`Update "${slug}" onto the latest image? Its data (courses, users, files) is preserved; the site restarts for ~30s.`)) return
        setBusySlug(slug)
        try {
            await axios.patch(`/api/academies/${slug}`, { updateImage: true })
            toast.success(`${slug}: updating to the latest image…`)
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Image update failed')
        } finally {
            setBusySlug(null)
        }
    }

    const toggleSuspend = async (slug: string, status: string) => {
        const suspend = status !== 'suspended'
        if (suspend && !window.confirm(`Suspend "${slug}"? Users will see a "suspended" notice until you resume it (data is kept).`)) return
        setBusySlug(slug)
        try {
            await axios.patch(`/api/academies/${slug}`, { suspend })
            setAcademies((list) => list.map((a) => (a.slug === slug ? { ...a, status: suspend ? 'suspended' : 'live' } : a)))
            toast.success(`${slug} ${suspend ? 'suspended' : 'resumed'}`)
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed')
        } finally {
            setBusySlug(null)
        }
    }

    const removeAcademy = async (slug: string) => {
        if (!window.confirm(`Delete "${slug}"? This tears down the live site and its data — cannot be undone.`)) return
        setBusySlug(slug)
        try {
            await axios.delete(`/api/academies/${slug}`)
            setAcademies((list) => list.filter((a) => a.slug !== slug))
            toast.success(`${slug} deleted`)
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Delete failed')
        } finally {
            setBusySlug(null)
        }
    }

    const options = licenses.filter((l) => l.active).map((l) => l.key)

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>🎓 Academies</h4>
                    <p className='text-sm text-gray-500 mt-1 max-w-2xl'>
                        Manage every academy: change its licence, suspend/resume it, pull the latest code, or delete it.
                        Licences are defined on the <strong>Licenses</strong> page.
                    </p>
                </div>
                <button
                    type='button'
                    onClick={updateAll}
                    disabled={updatingAll}
                    title='Recreate every live academy onto the latest baked image (after a new image is built + SAAS_IMAGE bumped). Data is preserved.'
                    className='shrink-0 rounded-md border border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-60'
                >
                    {updatingAll ? 'Updating…' : '⟳ Update all to latest image'}
                </button>
            </div>

            {/* Google login redirect-URI helper — Google has no API/wildcard for this. */}
            <div className='rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900'>
                <strong>Google login:</strong> for each academy, click <span className='font-semibold'>🔗 OAuth URL</span> to
                copy its redirect URI, then paste it into the{' '}
                <a href={GOOGLE_CONSOLE_URL} target='_blank' rel='noopener noreferrer' className='font-semibold underline'>
                    Google Cloud OAuth client
                </a>{' '}
                → <span className='font-mono'>Authorized redirect URIs</span> → Save. Sign in to Google as{' '}
                <span className='font-mono'>nitteam2024@gmail.com</span>. Google offers no API or wildcard, so this is one line per academy.
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-50 text-left text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 font-semibold'>Academy</th>
                            <th className='px-4 py-3 font-semibold'>Status</th>
                            <th className='px-4 py-3 font-semibold'>Licence</th>
                            <th className='px-4 py-3 font-semibold'>Change licence</th>
                            <th className='px-4 py-3 font-semibold'>Manage</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                        {loading ? (
                            <tr><td colSpan={5} className='px-4 py-10 text-center text-gray-400'>Loading…</td></tr>
                        ) : academies.length === 0 ? (
                            <tr><td colSpan={5} className='px-4 py-10 text-center text-gray-400'>No academies yet.</td></tr>
                        ) : academies.map((a) => (
                            <tr key={a.id} className='hover:bg-gray-50'>
                                <td className='px-4 py-3'>
                                    <div className='font-semibold text-gray-900'>{a.name}</div>
                                    <div className='text-xs text-gray-400 font-mono'>{a.slug}</div>
                                </td>
                                <td className='px-4 py-3'>
                                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${a.status === 'suspended' ? 'bg-red-50 text-red-600' : a.status === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {a.status}
                                    </span>
                                </td>
                                <td className='px-4 py-3 font-semibold text-[#0B2923]'>{licenseName(a.tier)}</td>
                                <td className='px-4 py-3'>
                                    <select
                                        className='border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50'
                                        value={a.tier}
                                        disabled={savingSlug === a.slug || options.length === 0}
                                        onChange={(e) => changeTier(a.slug, e.target.value)}
                                    >
                                        {/* current tier first, in case it's inactive/removed */}
                                        {!options.includes(a.tier) && <option value={a.tier}>{licenseName(a.tier)}</option>}
                                        {options.map((k) => (
                                            <option key={k} value={k}>{licenseName(k)}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className='px-4 py-3'>
                                    <div className='flex flex-wrap gap-1.5'>
                                        <button type='button' onClick={() => updateImage(a.slug)}
                                            disabled={busySlug === a.slug || !['live', 'suspended'].includes(a.status)}
                                            title='Update this academy onto the latest baked image (theme/core/plugin changes + token/settings refresh) — data is preserved'
                                            className='rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40'>
                                            {busySlug === a.slug ? '…' : '⟳ Update'}
                                        </button>
                                        <button type='button' onClick={() => setBrandingSlug(a.slug)}
                                            disabled={!['live', 'suspended'].includes(a.status)}
                                            title='Re-apply branding (logo, colours, hero, about, gallery, contact, login, footer) to this live academy'
                                            className='rounded-lg border border-[#268F79]/50 px-2.5 py-1.5 text-xs font-semibold text-[#268F79] hover:bg-[#268F79]/5 disabled:opacity-40'>
                                            🎨 Branding
                                        </button>
                                        <button type='button' onClick={() => copyRedirect(a.slug)}
                                            title={`Copy this academy's Google OAuth redirect URI:\n${redirectUri(a.slug)}\nThen paste it into the Google Cloud OAuth client (nitteam2024@gmail.com).`}
                                            className='rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50'>
                                            🔗 OAuth URL
                                        </button>
                                        <button type='button' onClick={() => toggleSuspend(a.slug, a.status)} disabled={busySlug === a.slug}
                                            title={a.status === 'suspended' ? 'Resume this academy' : 'Suspend (soft-lock) this academy'}
                                            className='rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50'>
                                            {a.status === 'suspended' ? '▶ Resume' : '⏸ Suspend'}
                                        </button>
                                        <button type='button' onClick={() => removeAcademy(a.slug)} disabled={busySlug === a.slug}
                                            title='Delete this academy permanently'
                                            className='rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50'>
                                            🗑 Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Re-apply-branding modal — reuses the build form in edit mode. */}
            {brandingSlug && (
                <div className='fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4'>
                    <div className='relative my-8 w-full max-w-xl'>
                        <div className='mb-2 flex items-center justify-between text-white'>
                            <span className='font-bold'>🎨 Branding — <span className='font-mono'>{brandingSlug}</span></span>
                            <button type='button' onClick={() => setBrandingSlug(null)}
                                className='rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20'>✕ Close</button>
                        </div>
                        <BuildProductForm
                            editSlug={brandingSlug}
                            onSuccess={() => { setBrandingSlug(null); toast.success('Branding queued — it applies in ~1 min'); }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default AcademiesPage
