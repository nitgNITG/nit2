'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

type Field = { key: string; secret: boolean; label: string }
type Values = Record<string, { set: boolean; value: string }>

// Inline eye / eye-off icons so no icon dependency is needed.
const EyeIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
        <circle cx='12' cy='12' r='3' />
    </svg>
)
const EyeOffIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' />
        <line x1='1' y1='1' x2='23' y2='23' />
    </svg>
)

// Group the flat field list by provider for a tidy form.
const GROUPS: { title: string; note: string; prefix: string }[] = [
    { title: 'Kashier (payments)', note: 'Shared payment gateway. Pushed to academies whose licence has “Kashier payments” on.', prefix: 'kashier_' },
    { title: 'VDOCipher (video DRM)', note: 'Pushed to academies whose licence Video source = vdocipher.', prefix: 'vdocipher_' },
    { title: 'Vimeo (video)', note: 'Pushed to academies whose licence Video source = vimeo.', prefix: 'vimeo_' },
]

const IntegrationsPage = () => {
    const [fields, setFields] = useState<Field[]>([])
    const [values, setValues] = useState<Values>({})
    const [edits, setEdits] = useState<Record<string, string>>({})
    const [show, setShow] = useState<Record<string, boolean>>({})
    const [revealed, setRevealed] = useState<Record<string, string>>({})
    const [revealLoaded, setRevealLoaded] = useState(false)
    const [revealing, setRevealing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/platform-settings/integrations')
            setFields(data.fields ?? [])
            setValues(data.values ?? {})
            setEdits({})
            setShow({})
            setRevealed({})
            setRevealLoaded(false)
        } catch {
            toast.error('Could not load integrations')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const save = async () => {
        setSaving(true)
        try {
            // Only send changed fields. For secrets, an empty value is skipped
            // server-side (keeps the stored secret).
            await axios.put('/api/platform-settings/integrations', edits)
            toast.success('Integrations saved')
            load()
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    // Toggle a secret field's visibility. The first time any field is revealed,
    // fetch the decrypted saved values (admin-only) so the eye can show what's
    // actually stored, not just what was just typed.
    const toggleShow = async (key: string) => {
        const next = !show[key]
        setShow((s) => ({ ...s, [key]: next }))
        if (next && !revealLoaded && !revealing) {
            setRevealing(true)
            try {
                const { data } = await axios.get('/api/platform-settings/integrations?reveal=1')
                const vals = (data.values ?? {}) as Values
                const map: Record<string, string> = {}
                for (const k of Object.keys(vals)) map[k] = vals[k]?.value ?? ''
                setRevealed(map)
                setRevealLoaded(true)
            } catch {
                toast.error('Could not reveal saved values')
            } finally {
                setRevealing(false)
            }
        }
    }

    const fieldsFor = (prefix: string) => fields.filter((f) => f.key.startsWith(prefix))

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8 max-w-3xl'>
            <div>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>🔌 Integrations</h4>
                <p className='text-sm text-gray-500 mt-1 max-w-2xl'>
                    NIT&apos;s shared Kashier / VDOCipher / Vimeo accounts. Stored encrypted and pushed
                    into each academy&apos;s Moodle at provisioning, based on its licence
                    (<strong>Licenses</strong> page: Video source + Kashier payments).
                    Leave a secret blank to keep the current value.
                </p>
            </div>

            {loading ? (
                <p className='text-gray-400'>Loading…</p>
            ) : (
                <div className='space-y-6'>
                    {GROUPS.map((g) => (
                        <div key={g.prefix} className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4'>
                            <div>
                                <h5 className='font-bold'>{g.title}</h5>
                                <p className='text-xs text-gray-400 mt-0.5'>{g.note}</p>
                            </div>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                {fieldsFor(g.prefix).map((f) => {
                                    const cur = values[f.key]
                                    const isShown = !!show[f.key]
                                    // For secrets: show the typed edit, else the decrypted saved
                                    // value once revealed, else nothing. Plain fields show their value.
                                    const display = f.secret
                                        ? (edits[f.key] ?? (isShown ? (revealed[f.key] ?? '') : ''))
                                        : (edits[f.key] ?? (cur?.value ?? ''))
                                    return (
                                        <div key={f.key}>
                                            <label className='block text-sm font-semibold mb-1'>
                                                {f.label}
                                                {f.secret && cur?.set && <span className='ml-2 text-[11px] font-normal text-emerald-600'>• set</span>}
                                            </label>
                                            <div className='relative'>
                                                <input
                                                    type={f.secret && !isShown ? 'password' : 'text'}
                                                    autoComplete='off'
                                                    className={`w-full border rounded-lg px-3 py-2 text-sm font-mono ${f.secret ? 'pr-10' : ''}`}
                                                    placeholder={f.secret ? (cur?.set ? '•••••••• (unchanged)' : 'not set') : ''}
                                                    value={display}
                                                    onChange={(e) => setEdits((p) => ({ ...p, [f.key]: e.target.value }))}
                                                />
                                                {f.secret && (
                                                    <button
                                                        type='button'
                                                        onClick={() => toggleShow(f.key)}
                                                        aria-label={isShown ? 'Hide value' : 'Show value'}
                                                        title={isShown ? 'Hide value' : 'Show value'}
                                                        className='absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600'
                                                    >
                                                        {isShown ? <EyeOffIcon /> : <EyeIcon />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    <div className='flex gap-3'>
                        <button type='button' onClick={save} disabled={saving || Object.keys(edits).length === 0}
                            className='bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-6 py-2 rounded-md disabled:opacity-60'>
                            {saving ? 'Saving…' : 'Save integrations'}
                        </button>
                        <button type='button' onClick={load} disabled={saving}
                            className='border border-gray-300 px-6 py-2 rounded-md text-gray-600 hover:bg-gray-50'>Reset</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default IntegrationsPage
