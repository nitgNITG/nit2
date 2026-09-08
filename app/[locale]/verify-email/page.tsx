'use client'

import React, { Suspense, useState } from 'react'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className='min-h-[70vh] bg-[#0B2923]' />}>
            <VerifyInner />
        </Suspense>
    )
}

function VerifyInner() {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const params = useSearchParams()

    const [email, setEmail] = useState(params.get('email') || '')
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)

    const verify = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!/^\d{6}$/.test(code.trim())) { toast.error(tr('الرمز 6 أرقام.', 'Code is 6 digits.')); return }
        setBusy(true)
        try {
            const res = await fetch('/api/auth/verify-email', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
            })
            const d = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(d?.message || tr('الرمز غير صحيح.', 'Invalid code.')); return }
            toast.success(tr('تم تأكيد بريدك!', 'Email verified!'))
            window.location.href = `/${locale}/account`
        } catch { toast.error(tr('تعذّر الاتصال.', 'Network error.')) } finally { setBusy(false) }
    }

    const resend = async () => {
        if (!email.trim()) { toast.error(tr('اكتب بريدك.', 'Enter your email.')); return }
        setBusy(true)
        try {
            const res = await fetch('/api/auth/verify-email/request', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase(), locale }),
            })
            const d = await res.json().catch(() => ({}))
            toast.success(d?.message || tr('اتبعت الرمز.', 'Code sent.'))
        } catch { toast.error(tr('تعذّر الاتصال.', 'Network error.')) } finally { setBusy(false) }
    }

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} className='min-h-[70vh] bg-[#0B2923] flex items-center justify-center px-4 py-16'>
            <div className='w-full max-w-md rounded-3xl bg-[#F5F3EE] p-8 shadow-2xl ring-1 ring-white/10'>
                <h1 className='text-2xl font-extrabold text-[#0B2923]'>{tr('تأكيد البريد', 'Verify your email')}</h1>
                <p className='mt-1 text-sm text-[#0B2923]/60'>
                    {tr('اكتب الرمز اللي وصل لبريدك لتأكيد حسابك.', 'Enter the code sent to your email to verify your account.')}
                </p>

                <form onSubmit={verify} className='mt-6 space-y-4'>
                    <label className='block'>
                        <span className='mb-1.5 block text-sm font-bold text-[#0B2923]'>{tr('البريد الإلكتروني', 'Email')}</span>
                        <input type='email' dir='ltr' autoComplete='email' value={email} onChange={(e) => setEmail(e.target.value)} className={input} placeholder='you@example.com' />
                    </label>
                    <label className='block'>
                        <span className='mb-1.5 block text-sm font-bold text-[#0B2923]'>{tr('الرمز', 'Code')}</span>
                        <input inputMode='numeric' dir='ltr' maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            className={`${input} tracking-[0.4em] text-center font-bold`} placeholder='••••••' />
                    </label>
                    <button type='submit' disabled={busy} className={btnPrimary}>
                        {busy ? tr('جارٍ…', '…') : tr('تأكيد', 'Verify')}
                    </button>
                    <button type='button' onClick={resend} disabled={busy} className='w-full text-sm font-bold text-[#1E7D67] hover:underline'>
                        {tr('لم يصلك الرمز؟ أعد الإرسال', 'Didn’t get it? Resend code')}
                    </button>
                </form>

                <p className='mt-6 text-center text-sm'>
                    <a href={`/${locale}/account`} className='font-bold text-[#1E7D67] hover:underline'>
                        {tr('العودة لتسجيل الدخول', 'Back to sign in')}
                    </a>
                </p>
            </div>
        </div>
    )
}

const input = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[#0B2923] outline-none transition-colors focus:border-[#1E7D67] focus:ring-2 focus:ring-[#1E7D67]/20'
const btnPrimary = 'w-full rounded-xl bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-3.5 text-base font-extrabold text-[#00FFB2] transition-transform hover:scale-[1.01] disabled:opacity-60'
