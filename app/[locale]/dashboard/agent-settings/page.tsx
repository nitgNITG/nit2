'use client'
// AI settings (FR-C1, FR-C2, FR-L3, US-13, US-29). Changes apply on the next
// message — no deploy. Saves carry the version they were based on; if someone
// saved meanwhile the server answers 409 and nothing is overwritten.
import React, { useCallback, useEffect, useState } from 'react'
import { api, btnGhost, btnPrimary, Card, errorText, inputCls, PageHeader } from '../components/agent/ui'

type Config = any
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PROFILES = ['fast', 'standard', 'complex']
const JSON_FIELDS = [
    { key: 'qualificationScripts', label: 'Qualification scripts (per service, asked one at a time)' },
    { key: 'pagePromptRules', label: 'Page prompts (matcher = path after /ar or /en, "*" = any page)' },
    { key: 'brochures', label: 'Brochure links (company + per service)' },
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return <Card className='space-y-3'><h5 className='font-semibold'>{title}</h5>{children}</Card>
}

export default function AgentSettingsPage() {
    const [cfg, setCfg] = useState<Config | null>(null)
    const [json, setJson] = useState<Record<string, string>>({})
    const [error, setError] = useState('')
    const [issues, setIssues] = useState<{ path: string; message: string }[]>([])
    const [saved, setSaved] = useState('')
    const [conflict, setConflict] = useState(false)
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        const r = await api<Config>('/api/agent/admin/config')
        if (!r.ok) return setError(errorText(r))
        setCfg(r.data)
        setJson(Object.fromEntries(JSON_FIELDS.map((f) => [f.key, JSON.stringify(r.data[f.key], null, 2)])))
        setConflict(false)
        setError('')
    }, [])
    useEffect(() => { load() }, [load])

    if (!cfg) return <div className='dashboard-container py-10 text-gray-400'>{error || 'Loading…'}</div>

    const set = (path: string, value: unknown) => {
        setSaved('')
        setCfg((c: Config) => {
            const next = structuredClone(c)
            const keys = path.split('.')
            let o = next
            for (const k of keys.slice(0, -1)) o = o[k]
            o[keys.at(-1)!] = value
            return next
        })
    }
    const num = (path: string) => (e: React.ChangeEvent<HTMLInputElement>) => set(path, e.target.value === '' ? 0 : Number(e.target.value))
    const text = (path: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(path, e.target.value)

    const save = async () => {
        setBusy(true)
        setError('')
        setIssues([])
        setSaved('')
        const body = structuredClone(cfg)
        for (const f of JSON_FIELDS) {
            try { body[f.key] = JSON.parse(json[f.key]) } catch {
                setBusy(false)
                return setError(`${f.label}: not valid JSON.`)
            }
        }
        body.suggestions = { ar: body.suggestions.ar.filter((s: string) => s.trim()), en: body.suggestions.en.filter((s: string) => s.trim()) }
        const r = await api<Config>('/api/agent/admin/config', { method: 'PUT', body: JSON.stringify(body) })
        setBusy(false)
        if (r.status === 409) return setConflict(true)
        if (!r.ok) { setIssues(r.data?.issues ?? []); return setError(errorText(r)) }
        setCfg(r.data)
        setSaved(`Saved — version ${r.data.version}. Visitors get the new settings on their next message.`)
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-5'>
            <PageHeader title='AI assistant settings' subtitle={`إعدادات المساعد الذكي · version ${cfg.version}`}>
                <div className='flex gap-2'>
                    <button className={btnGhost} onClick={load}>Reload</button>
                    <button className={btnPrimary} disabled={busy} onClick={save}>Save</button>
                </div>
            </PageHeader>
            {conflict && (
                <div role='alert' className='bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded text-sm'>
                    Someone saved the settings after you opened this page, so nothing was saved. Reload to get their version, then apply your changes again.
                    <button className={`${btnGhost} ml-3`} onClick={load}>Reload</button>
                </div>
            )}
            {error && <div role='alert' className='bg-red-50 text-red-700 p-3 rounded text-sm'>{error}{issues.length > 0 && <ul className='list-disc ml-5 mt-1'>{issues.map((i) => <li key={i.path}><code>{i.path}</code>: {i.message}</li>)}</ul>}</div>}
            {saved && <div role='status' className='bg-green-50 text-green-800 p-3 rounded text-sm'>{saved}</div>}

            <Section title='On / off and budget'>
                <div className='flex flex-wrap gap-6 text-sm'>
                    <label className='flex items-center gap-2'><input type='checkbox' checked={cfg.enabled.web} onChange={(e) => set('enabled.web', e.target.checked)} /> Website chat on</label>
                    <label className='flex items-center gap-2'><input type='checkbox' checked={cfg.enabled.whatsapp} onChange={(e) => set('enabled.whatsapp', e.target.checked)} /> WhatsApp on (phase 3)</label>
                    <label className='flex items-center gap-2'>Daily budget (USD)<input type='number' min={0} step='0.5' className={`${inputCls} w-28`} value={cfg.dailyBudgetUsd} onChange={num('dailyBudgetUsd')} /></label>
                </div>
                <p className='text-xs text-gray-500'>When off, or when the day&apos;s budget is used, visitors see the WhatsApp button and the contact form instead. A budget of 0 keeps the assistant off.</p>
            </Section>

            <Section title='Greeting and suggested questions'>
                <div className='grid md:grid-cols-2 gap-4'>
                    {(['ar', 'en'] as const).map((l) => (
                        <div key={l} className='space-y-2' dir={l === 'ar' ? 'rtl' : 'ltr'}>
                            <label className='text-sm block'>{l === 'ar' ? 'الترحيب' : 'Greeting'}<textarea rows={3} className={inputCls} value={cfg.greeting[l]} onChange={text(`greeting.${l}`)} /></label>
                            {[0, 1, 2].map((i) => (
                                <input key={i} aria-label={`Suggestion ${i + 1} (${l})`} className={inputCls} value={cfg.suggestions[l][i] ?? ''}
                                    onChange={(e) => { const s = [...cfg.suggestions[l]]; s[i] = e.target.value; set(`suggestions.${l}`, s) }} placeholder={l === 'ar' ? `سؤال مقترح ${i + 1}` : `Suggested question ${i + 1}`} />
                            ))}
                        </div>
                    ))}
                </div>
                <p className='text-xs text-gray-500'>Keep the greeting saying it is an AI assistant (NFR-13).</p>
            </Section>

            <Section title='Working hours (for handoffs)'>
                <div className='flex flex-wrap gap-3 text-sm items-end'>
                    {DAYS.map((d, i) => (
                        <label key={d} className='flex items-center gap-1'>
                            <input type='checkbox' checked={cfg.workingHours.days.includes(i)} onChange={(e) => set('workingHours.days', e.target.checked ? [...cfg.workingHours.days, i].sort() : cfg.workingHours.days.filter((x: number) => x !== i))} />{d}
                        </label>
                    ))}
                    <label>From<input type='time' className={`${inputCls} w-28`} value={cfg.workingHours.from} onChange={text('workingHours.from')} /></label>
                    <label>To<input type='time' className={`${inputCls} w-28`} value={cfg.workingHours.to} onChange={text('workingHours.to')} /></label>
                    <label>Time zone<input className={`${inputCls} w-40`} value={cfg.workingHours.tz} onChange={text('workingHours.tz')} /></label>
                </div>
            </Section>

            <Section title='Knowledge notes (added to what the assistant knows)'>
                <div className='grid md:grid-cols-2 gap-4'>
                    <textarea aria-label='Notes (Arabic)' dir='rtl' rows={6} className={inputCls} value={cfg.notes.ar} onChange={text('notes.ar')} placeholder='ملاحظات للمساعد بالعربية' />
                    <textarea aria-label='Notes (English)' rows={6} className={inputCls} value={cfg.notes.en} onChange={text('notes.en')} placeholder='Notes for the assistant in English' />
                </div>
                <p className='text-xs text-gray-500'>Facts only — never prices (prices come from Plans and Price Ranges).</p>
            </Section>

            <Section title='Company facts (the only figures the assistant may state)'>
                <div className='flex flex-wrap gap-4 text-sm'>
                    <label>Founded<input type='number' className={`${inputCls} w-24`} value={cfg.companyFacts.foundedYear} onChange={num('companyFacts.foundedYear')} /></label>
                    <label>Projects<input className={`${inputCls} w-24`} value={cfg.companyFacts.projects} onChange={text('companyFacts.projects')} /></label>
                    <label>Moodle platforms<input className={`${inputCls} w-24`} value={cfg.companyFacts.moodlePlatforms} onChange={text('companyFacts.moodlePlatforms')} /></label>
                </div>
                <p className='text-xs text-gray-500'>Years of experience are computed from the founding year automatically.</p>
            </Section>

            <Section title='Models'>
                <div className='flex gap-4 text-sm'>
                    {(['chat', 'summary'] as const).map((k) => (
                        <label key={k} className='capitalize'>{k}
                            <select className={`${inputCls} w-36`} value={cfg.modelProfiles[k]} onChange={text(`modelProfiles.${k}`)}>
                                {PROFILES.map((p) => <option key={p}>{p}</option>)}
                            </select>
                        </label>
                    ))}
                </div>
                <p className='text-xs text-gray-500'>fast = Claude Haiku 4.5 · standard = Claude Sonnet 5.5 · complex = Claude Opus 5.5</p>
            </Section>

            <Section title='Lead scoring'>
                <div className='flex gap-4 text-sm'>
                    <label>HOT from<input type='number' min={1} max={100} className={`${inputCls} w-20`} value={cfg.scoring.thresholds.hot} onChange={num('scoring.thresholds.hot')} /></label>
                    <label>WARM from<input type='number' min={0} max={99} className={`${inputCls} w-20`} value={cfg.scoring.thresholds.warm} onChange={num('scoring.thresholds.warm')} /></label>
                </div>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
                    {Object.keys(cfg.scoring.weights).map((k) => (
                        <label key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}<input type='number' min={0} max={100} className={inputCls} value={cfg.scoring.weights[k]} onChange={num(`scoring.weights.${k}`)} /></label>
                    ))}
                </div>
                <p className='text-xs text-gray-500'>New weights apply to leads when they are next updated; each lead keeps the settings version its score was computed with.</p>
            </Section>

            <Section title='Limits'>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-3 text-xs'>
                    {Object.keys(cfg.limits).map((k) => (
                        <label key={k}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}<input type='number' className={inputCls} value={cfg.limits[k]} onChange={num(`limits.${k}`)} /></label>
                    ))}
                </div>
            </Section>

            {JSON_FIELDS.map((f) => (
                <Section key={f.key} title={f.label}>
                    <textarea aria-label={f.label} rows={10} spellCheck={false} className={`${inputCls} font-mono text-xs`} value={json[f.key]} onChange={(e) => { setSaved(''); setJson({ ...json, [f.key]: e.target.value }) }} />
                </Section>
            ))}

            <div className='flex justify-end'><button className={btnPrimary} disabled={busy} onClick={save}>Save settings</button></div>
        </div>
    )
}
