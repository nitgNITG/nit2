'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

// Stores tab of Platform Settings — the store counterpart of the academy globals.
// Field definitions come from the API (lib/storeSettings.ts STORE_FIELDS) so the
// form and the storage never drift. Secrets are write-only (blank = keep).
type Field = { key: string; label: string; secret: boolean; host: string | null; hint?: string; placeholder?: string; group: string }
type Values = Record<string, { set: boolean; value: string }>

const GROUPS: { id: string; title: string; note: string }[] = [
    { id: 'creation', title: 'Store creation', note: 'Control-plane guards on the self-serve "create store" flow. Not pushed anywhere.' },
    { id: 'updates', title: 'Updates', note: 'How the store host follows new releases. The version picker on the Stores page always works regardless.' },
    { id: 'mail', title: 'E-mail (sent by the stores)', note: 'The SMTP account each store uses for its welcome / owner-reset mails. Expiry reminders are sent by this site’s own MAIL_* account instead.' },
    { id: 'cloudinary', title: 'Cloudinary (images)', note: 'Store logos and product images. Every store uploads under its own folder stores/<slug>.' },
    { id: 'google', title: 'Google login & links', note: '"Sign in with Google" on the storefronts, and where the store dashboard sends the owner to manage the subscription.' },
    { id: 'resources', title: 'Resources', note: 'Per-store container limits and upload size. Memory changes apply when a store’s containers are next recreated (rollout or push).' },
]

export default function StoreSettingsTab() {
    const [fields, setFields] = useState<Field[]>([])
    const [values, setValues] = useState<Values>({})
    const [form, setForm] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pushing, setPushing] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/platform-settings/stores')
            setFields(data.fields ?? [])
            setValues(data.values ?? {})
            setForm(Object.fromEntries((data.fields ?? []).map((f: Field) => [f.key, data.values?.[f.key]?.value ?? ''])))
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Could not load store settings')
        } finally {
            setLoading(false)
        }
    }, [])
    useEffect(() => { load() }, [load])

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const { data } = await axios.put('/api/platform-settings/stores', form)
            toast.success(`Saved (${data.updated} value${data.updated === 1 ? '' : 's'})`)
            await load()
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    // Saved host values → provisioner → provision.env + every running store.
    const push = async () => {
        if (!window.confirm('Push the saved host settings to the store host now? Stores whose environment changes are restarted (a few seconds each).')) return
        setPushing(true)
        try {
            const { data } = await axios.post('/api/platform-settings/apply-stores')
            const changed: string[] = data.changed ?? []
            toast.success(changed.length ? `Pushed: ${changed.join(', ')} → applying to ${data.stores} store(s)` : 'Host already up to date')
        } catch (e: any) {
            toast.error(e?.response?.data?.error || 'Push failed')
        } finally {
            setPushing(false)
        }
    }

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
    const hostDirty = fields.some((f) => f.host && !f.secret && (form[f.key] ?? '') !== (values[f.key]?.value ?? ''))

    return (
        <form onSubmit={save} className='space-y-6 max-w-3xl'>
            {GROUPS.map((g) => {
                const fs = fields.filter((f) => f.group === g.id)
                if (!fs.length) return null
                return (
                    <div key={g.id} className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4'>
                        <div>
                            <h5 className='font-bold text-lg'>{g.title}</h5>
                            <p className='text-xs text-gray-400 mt-1'>{g.note}</p>
                        </div>
                        {fs.map((f) => (
                            <div key={f.key}>
                                <label className='block text-sm font-semibold mb-1'>
                                    {f.label}
                                    {f.host && <span className='ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500' title='Pushed to the store host as this provision.env key'>{f.host}</span>}
                                    {f.secret && <span className={`ml-2 text-[10px] font-normal ${values[f.key]?.set ? 'text-green-600' : 'text-amber-600'}`}>{values[f.key]?.set ? '● set' : '○ not set'}</span>}
                                </label>
                                <input
                                    type={f.secret ? 'password' : 'text'}
                                    autoComplete='off'
                                    className='w-full border rounded-lg px-3 py-2 font-mono text-sm disabled:opacity-50'
                                    value={form[f.key] ?? ''}
                                    placeholder={f.secret ? (values[f.key]?.set ? '•••••••• (blank = keep)' : '') : f.placeholder}
                                    disabled={loading}
                                    onChange={(e) => set(f.key, e.target.value)}
                                />
                                {f.hint && <p className='text-xs text-gray-400 mt-1'>{f.hint}</p>}
                            </div>
                        ))}
                    </div>
                )
            })}

            <div className='flex flex-wrap items-center gap-3'>
                <button type='submit' disabled={saving || loading}
                    className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-6 py-2 rounded-md disabled:opacity-60'>
                    {saving ? 'Saving…' : 'Save store settings'}
                </button>
                <button type='button' onClick={push} disabled={pushing || loading || saving}
                    title={hostDirty ? 'Save first — unsaved values are not pushed' : undefined}
                    className='border border-[#268F79] px-6 py-2 rounded-md text-[#268F79] font-semibold hover:bg-[#268F79]/5 disabled:opacity-60'>
                    {pushing ? 'Pushing…' : '🚀 Push to store host'}
                </button>
                <button type='button' onClick={load} disabled={loading}
                    className='border border-gray-300 px-6 py-2 rounded-md text-gray-600 hover:bg-gray-50'>
                    Reload
                </button>
                {hostDirty && <span className='text-xs text-amber-600'>Unsaved host values — save, then push.</span>}
            </div>
            <p className='text-xs text-gray-400'>
                “Push” rewrites <span className='font-mono'>provision.env</span> on the store host and re-applies mail / Cloudinary / Google / memory
                to every running store. New stores always get the pushed values. Blank values are never pushed (they keep what is on the host).
            </p>
        </form>
    )
}
