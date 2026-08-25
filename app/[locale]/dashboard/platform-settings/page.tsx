'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

// Must match PLATFORM_KEYS in app/api/platform-settings/route.ts
type FieldDef = { key: string; label: string; hint?: string; placeholder?: string }

const GROUPS: { title: string; note: string; fields: FieldDef[] }[] = [
    {
        title: 'OAuth client ids',
        note: 'Bound to the app binary — the SAME value for every academy. Changing these breaks social login until every academy is re-synced.',
        fields: [
            { key: 'google_client_id', label: 'Google client id', placeholder: '000-abc.apps.googleusercontent.com' },
            { key: 'google_client_secret', label: 'Google client secret', hint: 'Enables "Sign in with Google" on every academy login page. Add each academy domain’s https://<domain>/admin/oauth2callback.php to the OAuth client’s authorized redirect URIs.', placeholder: 'GOCSPX-…' },
            { key: 'apple_client_id', label: 'Apple client id', placeholder: 'com.nit.academy.service' },
            { key: 'facebook_app_id', label: 'Facebook app id', placeholder: '000000000000000' },
        ],
    },
    {
        title: 'App store / force-update',
        note: 'The store links and the minimum version the app must run. Same for every academy (one published app).',
        fields: [
            { key: 'android_version', label: 'Android min version', placeholder: '1.0.0' },
            { key: 'android_url', label: 'Play Store URL', placeholder: 'https://play.google.com/store/apps/details?id=com.nit.academy' },
            { key: 'ios_version', label: 'iOS min version', placeholder: '1.0.0' },
            { key: 'ios_url', label: 'App Store URL', placeholder: 'https://apps.apple.com/app/id000000000' },
        ],
    },
]

const ALL_KEYS = GROUPS.flatMap((g) => g.fields.map((f) => f.key))
const emptyForm = () => Object.fromEntries(ALL_KEYS.map((k) => [k, ''])) as Record<string, string>

const PlatformSettingsPage = () => {
    const [form, setForm] = useState<Record<string, string>>(emptyForm)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [applying, setApplying] = useState(false)
    const [freeLimit, setFreeLimit] = useState('1')
    const [savingLimit, setSavingLimit] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [s, fl] = await Promise.all([axios.get('/api/platform-settings'), axios.get('/api/free-academy-limit')])
            setForm({ ...emptyForm(), ...(s.data.settings ?? {}) })
            setFreeLimit(String(fl.data.limit ?? 1))
        } catch {
            toast.error('Could not load settings')
        } finally {
            setLoading(false)
        }
    }, [])

    const saveLimit = async () => {
        setSavingLimit(true)
        try {
            await axios.put('/api/free-academy-limit', { limit: Number(freeLimit) })
            toast.success('Free academy limit saved')
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Save failed')
        } finally {
            setSavingLimit(false)
        }
    }

    useEffect(() => { load() }, [load])

    const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

    // Re-push the saved globals to every LIVE academy's Moodle (new academies get
    // them automatically at build time; this is for when a value changes).
    const applyAll = async () => {
        if (!window.confirm('Push these settings to every live academy now?')) return
        setApplying(true)
        try {
            const { data } = await axios.post('/api/platform-settings/apply')
            toast.success(`Queued for ${data.queued}/${data.academies} academies`)
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Apply failed')
        } finally {
            setApplying(false)
        }
    }

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.put('/api/platform-settings', form)
            toast.success('Saved')
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>🌐 Platform Settings</h4>
                <p className='text-sm text-gray-500 mt-1 max-w-2xl'>
                    Global values that must be identical for <strong>every</strong> academy. Stored once here and pushed
                    into each academy&rsquo;s Moodle when it is provisioned. Per-academy secrets (tokens, payment
                    credentials, VdoCipher keys) are <strong>not</strong> here — those live in each academy&rsquo;s own settings.
                </p>
            </div>

            {/* Free-academy limit — control-plane only (not pushed to academies). */}
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-3xl'>
                <h5 className='font-bold text-lg'>Free academies per account</h5>
                <p className='text-xs text-gray-400 mt-1'>
                    How many <strong>free</strong> academies one user can create (across all free licences). Paid licences
                    are gated by payment — no limit. <span className='font-mono'>-1</span> = unlimited.
                </p>
                <div className='mt-3 flex items-center gap-3'>
                    <input
                        type='number'
                        className='w-28 border rounded-lg px-3 py-2 disabled:opacity-50'
                        value={freeLimit}
                        disabled={loading}
                        onChange={(e) => setFreeLimit(e.target.value)}
                    />
                    <button type='button' onClick={saveLimit} disabled={savingLimit || loading}
                        className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-5 py-2 rounded-md disabled:opacity-60'>
                        {savingLimit ? 'Saving…' : 'Save limit'}
                    </button>
                </div>
            </div>

            <form onSubmit={save} className='space-y-6 max-w-3xl'>
                {GROUPS.map((group) => (
                    <div key={group.title} className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4'>
                        <div>
                            <h5 className='font-bold text-lg'>{group.title}</h5>
                            <p className='text-xs text-gray-400 mt-1'>{group.note}</p>
                        </div>
                        {group.fields.map((field) => (
                            <div key={field.key}>
                                <label className='block text-sm font-semibold mb-1'>{field.label}</label>
                                <input
                                    className='w-full border rounded-lg px-3 py-2 font-mono text-sm disabled:opacity-50'
                                    value={form[field.key] ?? ''}
                                    placeholder={field.placeholder}
                                    disabled={loading}
                                    onChange={(e) => set(field.key, e.target.value)}
                                />
                                {field.hint && <p className='text-xs text-gray-400 mt-1'>{field.hint}</p>}
                            </div>
                        ))}
                    </div>
                ))}

                <div className='flex items-center gap-3'>
                    <button type='submit' disabled={saving || loading}
                        className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-6 py-2 rounded-md disabled:opacity-60'>
                        {saving ? 'Saving…' : 'Save settings'}
                    </button>
                    <button type='button' onClick={load} disabled={loading}
                        className='border border-gray-300 px-6 py-2 rounded-md text-gray-600 hover:bg-gray-50'>
                        Reload
                    </button>
                    <button type='button' onClick={applyAll} disabled={applying || loading}
                        className='border border-[#268F79] px-6 py-2 rounded-md text-[#268F79] font-semibold hover:bg-[#268F79]/5 disabled:opacity-60'>
                        {applying ? 'Applying…' : 'Apply to all academies'}
                    </button>
                    {loading && <span className='text-sm text-gray-400'>Loading…</span>}
                </div>
            </form>
        </div>
    )
}

export default PlatformSettingsPage
