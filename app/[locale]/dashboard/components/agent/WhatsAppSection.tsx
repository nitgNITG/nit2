'use client'
// AI Settings → WhatsApp (phase 3): Cloud API number id, account id and access
// token (stored encrypted, never shown again), the webhook values to paste into
// Meta, and a test send. The AI on/off switch is "AI answers on WhatsApp" at the top.
import React, { useEffect, useState } from 'react'
import { api, btnGhost, btnPrimary, errorText, inputCls } from './ui'

type Status = {
    phoneNumberId: string; wabaId: string; graphVersion: string; tokenSet: boolean; tokenSource: 'dashboard' | 'env' | null
    appSecretSet: boolean; verifyTokenSet: boolean; encryptionReady: boolean; webhookUrl: string
}

function Check({ ok, label, fix }: { ok: boolean; label: string; fix: string }) {
    return (
        <li className='flex gap-2 text-sm'>
            <span aria-hidden className={ok ? 'text-emerald-600' : 'text-red-600'}>{ok ? '✓' : '✗'}</span>
            <span>{label}{!ok && <span className='block text-xs text-gray-500'>{fix}</span>}</span>
        </li>
    )
}

export default function WhatsAppSection() {
    const [s, setS] = useState<Status | null>(null)
    const [form, setForm] = useState({ phoneNumberId: '', wabaId: '', accessToken: '', graphVersion: '' })
    const [to, setTo] = useState('')
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [busy, setBusy] = useState(false)

    const apply = (st: Status) => { setS(st); setForm({ phoneNumberId: st.phoneNumberId, wabaId: st.wabaId, accessToken: '', graphVersion: st.graphVersion }) }
    useEffect(() => { api<Status>('/api/agent/admin/whatsapp').then((r) => (r.ok ? apply(r.data) : setMsg({ ok: false, text: errorText(r) }))) }, [])

    const save = async () => {
        setBusy(true); setMsg(null)
        const r = await api<Status>('/api/agent/admin/whatsapp', {
            method: 'PUT',
            body: JSON.stringify({ phoneNumberId: form.phoneNumberId, wabaId: form.wabaId, graphVersion: form.graphVersion || undefined, ...(form.accessToken ? { accessToken: form.accessToken } : {}) }),
        })
        setBusy(false)
        if (!r.ok) return setMsg({ ok: false, text: errorText(r) })
        apply(r.data)
        setMsg({ ok: true, text: 'WhatsApp settings saved.' })
    }
    const test = async () => {
        setBusy(true); setMsg(null)
        const r = await api<{ id: string }>('/api/agent/admin/whatsapp', { method: 'POST', body: JSON.stringify({ to }) })
        setBusy(false)
        setMsg(r.ok ? { ok: true, text: `Sent Meta's "hello_world" template to ${to}. It should arrive within seconds.` } : { ok: false, text: errorText(r) })
    }

    if (!s) return <p className='text-sm text-gray-400'>{msg?.text ?? 'Loading…'}</p>
    const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

    return (
        <div className='space-y-4'>
            <ul className='space-y-1'>
                <Check ok={s.tokenSet} label={`Access token${s.tokenSource ? ` (from ${s.tokenSource})` : ''}`} fix='Paste the permanent System User token below.' />
                <Check ok={!!s.phoneNumberId} label='Phone number ID' fix='WhatsApp → API Setup in the Meta app.' />
                <Check ok={s.appSecretSet} label='WHATSAPP_APP_SECRET on the server' fix='Meta app → App settings → Basic → App secret, into the server .env, then restart.' />
                <Check ok={s.verifyTokenSet} label='WHATSAPP_VERIFY_TOKEN on the server' fix='Any long random string, in the server .env and in Meta → WhatsApp → Configuration.' />
                <Check ok={s.encryptionReady} label='CREDENTIAL_SECRET on the server (encrypts the token)' fix='Needed before the token can be saved here.' />
            </ul>

            <div className='rounded-lg bg-gray-50 p-3 text-xs text-gray-600 space-y-1'>
                <div>In Meta → WhatsApp → Configuration → Webhook:</div>
                <div>Callback URL: <code className='select-all rounded bg-white px-1.5 py-0.5 text-gray-800'>{s.webhookUrl}</code></div>
                <div>Verify token: the value of <code>WHATSAPP_VERIFY_TOKEN</code> · Webhook field: subscribe to <code>messages</code></div>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
                <label className='text-sm'>Phone number ID<input className={inputCls} inputMode='numeric' value={form.phoneNumberId} onChange={field('phoneNumberId')} /></label>
                <label className='text-sm'>WhatsApp Business Account ID<input className={inputCls} inputMode='numeric' value={form.wabaId} onChange={field('wabaId')} /></label>
                <label className='text-sm md:col-span-2'>Access token {s.tokenSet && <span className='text-xs text-gray-500'>(saved — leave empty to keep it)</span>}
                    <input type='password' autoComplete='off' className={inputCls} value={form.accessToken} onChange={field('accessToken')} placeholder={s.tokenSet ? '••••••••' : 'EAAG…'} />
                </label>
                <label className='text-sm'>Graph API version<input className={inputCls} value={form.graphVersion} onChange={field('graphVersion')} placeholder='v23.0' /></label>
            </div>
            <button type='button' className={btnPrimary} disabled={busy || !form.phoneNumberId} onClick={save}>Save WhatsApp settings</button>

            <div className='flex flex-wrap items-end gap-2 border-t pt-3'>
                <label className='text-sm'>Send a test to<input className={`${inputCls} w-56`} dir='ltr' value={to} onChange={(e) => setTo(e.target.value)} placeholder='+201001234567' /></label>
                <button type='button' className={btnGhost} disabled={busy || !to || !s.tokenSet} onClick={test}>Send test</button>
                <p className='w-full text-xs text-gray-500'>With Meta&apos;s test number, add the recipient under API Setup → &quot;To&quot; first.</p>
            </div>
            {msg && <p role='status' className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-600'}>{msg.text}</p>}
        </div>
    )
}
