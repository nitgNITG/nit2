'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'

type Mode = 'login' | 'register'
type FormValues = { name?: string; email: string; password: string }

export default function AuthScreen({ mode: initialMode = 'login' }: { mode?: Mode }) {
    const t = useTranslations('Auth')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const [mode, setMode] = useState<Mode>(initialMode)
    const {
        register, handleSubmit, reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>()

    const switchMode = (m: Mode) => { setMode(m); reset() }

    const onSubmit = async (values: FormValues) => {
        const url = mode === 'login' ? '/api/sign-in' : '/api/register'
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(data?.message || t('errorGeneric')); return }
            toast.success(mode === 'login' ? t('welcomeBack') : t('accountCreated'))
            // Full reload so the navbar re-reads /api/me and shows the signed-in state.
            window.location.href = `/${locale}/account`
        } catch {
            toast.error(t('errorNetwork'))
        }
    }

    return (
        <div className='w-full bg-[#0B2923] px-4 py-10 md:py-16 flex items-stretch'>
            <div className='m-auto w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 lg:min-h-[520px]'>

                {/* ── Brand / launch panel ─────────────────────────────────── */}
                <aside className='relative hidden lg:flex flex-col justify-center p-10 text-white overflow-hidden
                                  bg-gradient-to-br from-[#0E3329] via-[#0B2923] to-[#071c18]'>
                    {/* faint grid texture */}
                    <div aria-hidden className='absolute inset-0 opacity-[0.06]'
                         style={{ backgroundImage: 'linear-gradient(#00FFB2 1px,transparent 1px),linear-gradient(90deg,#00FFB2 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

                    <div className='relative'>
                        <span className='inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/80'>
                            <span className='w-1.5 h-1.5 rounded-full bg-[#00FFB2] animate-pulse motion-reduce:animate-none' />
                            NIT
                        </span>
                        <h1 className='mt-6 text-3xl xl:text-4xl font-extrabold leading-tight'>
                            {t('brandTitle')}
                        </h1>
                        <p className='mt-3 text-white/70 leading-relaxed max-w-sm'>
                            {t('brandSubtitle')}
                        </p>
                    </div>

                </aside>

                {/* ── Form panel ──────────────────────────────────────────── */}
                <section className='bg-[#F5F3EE] p-7 sm:p-10 flex flex-col justify-center'>
                    {/* segmented mode toggle */}
                    <div className='inline-flex self-start rounded-full bg-black/[0.04] p-1 ring-1 ring-black/5'>
                        {(['login', 'register'] as Mode[]).map((m) => (
                            <button
                                key={m}
                                type='button'
                                onClick={() => switchMode(m)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                                    mode === m ? 'bg-[#0B2923] text-[#00FFB2]' : 'text-[#0B2923]/60 hover:text-[#0B2923]'
                                }`}
                            >
                                {m === 'login' ? t('tabLogin') : t('tabRegister')}
                            </button>
                        ))}
                    </div>

                    <h2 className='mt-6 text-2xl font-extrabold text-[#0B2923]'>
                        {mode === 'login' ? t('loginTitle') : t('registerTitle')}
                    </h2>
                    <p className='mt-1 text-[#0B2923]/60 text-sm'>
                        {mode === 'login' ? t('loginSub') : t('registerSub')}
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className='mt-6 space-y-4' noValidate>
                        {mode === 'register' && (
                            <Field label={t('name')} error={errors.name?.message}>
                                <input
                                    type='text'
                                    autoComplete='name'
                                    className={inputCls}
                                    placeholder={t('namePlaceholder')}
                                    {...register('name', { required: t('nameRequired'), minLength: { value: 2, message: t('nameRequired') } })}
                                />
                            </Field>
                        )}

                        <Field label={t('email')} error={errors.email?.message}>
                            <input
                                type='email'
                                dir='ltr'
                                autoComplete='email'
                                className={`${inputCls} ${isAr ? 'text-right' : ''}`}
                                placeholder='you@example.com'
                                {...register('email', { required: t('emailRequired') })}
                            />
                        </Field>

                        <Field label={t('password')} error={errors.password?.message}>
                            <input
                                type='password'
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                className={inputCls}
                                placeholder='••••••••'
                                {...register('password', {
                                    required: t('passwordRequired'),
                                    minLength: mode === 'register' ? { value: 8, message: t('passwordShort') } : undefined,
                                })}
                            />
                        </Field>

                        <button
                            type='submit'
                            disabled={isSubmitting}
                            className='w-full mt-2 rounded-xl bg-gradient-to-b from-[#1E7D67] to-[#0B2923] px-6 py-3.5 text-base font-extrabold text-[#00FFB2] transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed'
                        >
                            {isSubmitting ? t('submitting') : mode === 'login' ? t('loginCta') : t('registerCta')}
                        </button>
                    </form>

                    <p className='mt-6 text-sm text-[#0B2923]/60'>
                        {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
                        <button
                            type='button'
                            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                            className='font-bold text-[#1E7D67] hover:underline'
                        >
                            {mode === 'login' ? t('tabRegister') : t('tabLogin')}
                        </button>
                    </p>
                </section>
            </div>
        </div>
    )
}

const inputCls =
    'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[#0B2923] outline-none transition-colors focus:border-[#1E7D67] focus:ring-2 focus:ring-[#1E7D67]/20'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <label className='block'>
            <span className='mb-1.5 block text-sm font-bold text-[#0B2923]'>{label}</span>
            {children}
            {error && <span className='mt-1 block text-sm text-red-600'>{error}</span>}
        </label>
    )
}
