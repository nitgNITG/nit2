'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

type Field = { key: string; secret: boolean; label: string }
type Values = Record<string, { set: boolean; value: string }>

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
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/platform-settings/integrations')
            setFields(data.fields ?? [])
            setValues(data.values ?? {})
            setEdits({})
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
                                    return (
                                        <div key={f.key}>
                                            <label className='block text-sm font-semibold mb-1'>
                                                {f.label}
                                                {f.secret && cur?.set && <span className='ml-2 text-[11px] font-normal text-emerald-600'>• set</span>}
                                            </label>
                                            <input
                                                type={f.secret ? 'password' : 'text'}
                                                autoComplete='off'
                                                className='w-full border rounded-lg px-3 py-2 text-sm font-mono'
                                                placeholder={f.secret ? (cur?.set ? '•••••••• (unchanged)' : 'not set') : ''}
                                                value={edits[f.key] ?? (f.secret ? '' : (cur?.value ?? ''))}
                                                onChange={(e) => setEdits((p) => ({ ...p, [f.key]: e.target.value }))}
                                            />
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
