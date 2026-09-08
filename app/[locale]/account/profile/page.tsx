'use client'

import React, { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import axios from 'axios'
import toast from 'react-hot-toast'
import LocaleLink from '../../components/LocaleLink'
import { useMe, setCachedMe } from '../../components/useMe'

export default function ProfilePage() {
    const locale = useLocale()
    const isAr = locale === 'ar'
    const tr = (ar: string, en: string) => (isAr ? ar : en)
    const me = useMe()

    const [name, setName] = useState('')
    const [savingName, setSavingName] = useState(false)
    const [curPw, setCurPw] = useState('')
    const [newPw, setNewPw] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [savingPw, setSavingPw] = useState(false)

    useEffect(() => { if (me) setName(me.name ?? '') }, [me])

    const saveName = async () => {
        const clean = name.trim()
        if (clean.length < 2) { toast.error(tr('الاسم قصير جدًا.', 'Name is too short.')); return }
        setSavingName(true)
        try {
            const { data } = await axios.patch('/api/me', { name: clean })
            setCachedMe(data.user)
            toast.success(tr('تم تحديث الاسم.', 'Name updated.'))
        } catch (e: any) {
            toast.error(e?.response?.data?.error || tr('تعذّر الحفظ.', 'Could not save.'))
        } finally {
            setSavingName(false)
        }
    }

    const savePassword = async () => {
        if (newPw.length < 8) { toast.error(tr('كلمة المرور الجديدة 8 أحرف على الأقل.', 'New password must be at least 8 characters.')); return }
        if (newPw !== confirmPw) { toast.error(tr('كلمتا المرور غير متطابقتين.', 'Passwords do not match.')); return }
        setSavingPw(true)
        try {
            await axios.patch('/api/me', { currentPassword: curPw, newPassword: newPw })
            setCurPw(''); setNewPw(''); setConfirmPw('')
            toast.success(tr('تم تغيير كلمة المرور.', 'Password changed.'))
        } catch (e: any) {
            toast.error(e?.response?.data?.error || tr('تعذّر تغيير كلمة المرور.', 'Could not change password.'))
        } finally {
            setSavingPw(false)
        }
    }

    // Not signed in.
    if (me === null) {
        return (
            <div dir={isAr ? 'rtl' : 'ltr'} className='mx-auto max-w-md px-4 py-24 text-center'>
                <p className='text-[#0B2923]'>{tr('لازم تسجّل الدخول الأول.', 'Please sign in first.')}</p>
                <LocaleLink href='/account' className='mt-4 inline-block rounded-full bg-[#0B2923] px-6 py-2.5 font-bold text-[#00FFB2]'>
                    {tr('تسجيل الدخول', 'Sign in')}
                </LocaleLink>
            </div>
        )
    }

    const input = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#1E7D67] focus:bg-white'
    const label = 'mb-1.5 block text-sm font-semibold text-[#0B2923]'
    const card = 'rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-6'

    return (
        <div dir={isAr ? 'rtl' : 'ltr'} className='mx-auto max-w-lg px-4 py-10'>
            <div className='mb-6 flex items-center justify-between'>
                <h1 className='text-2xl font-extrabold text-[#0B2923]'>{tr('الملف الشخصي', 'Profile')}</h1>
                <LocaleLink href='/account' className='text-sm font-bold text-[#1E7D67] hover:underline'>
                    {tr('منصاتي ←', '← My platforms')}
                </LocaleLink>
            </div>

            {/* Account details */}
            <div className={`${card} mb-5`}>
                <div className='mb-4 flex items-center gap-3'>
                    <span className='flex h-12 w-12 items-center justify-center rounded-full bg-[#00FFB2] text-xl font-extrabold text-[#0B2923]'>
                        {(me?.name || me?.email || '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <div className='min-w-0'>
                        <p className='truncate font-bold text-[#0B2923]'>{me?.name || tr('بدون اسم', 'No name')}</p>
                        <p className='truncate text-xs text-gray-500' dir='ltr'>{me?.email}</p>
                    </div>
                    {me?.role === 'admin' && (
                        <span className='ms-auto rounded-full bg-[#1E7D67]/10 px-2.5 py-1 text-xs font-bold text-[#1E7D67]'>admin</span>
                    )}
                </div>

                <label className={label}>{tr('الاسم', 'Display name')}</label>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('اسمك', 'Your name')} />

                <label className={`${label} mt-4`}>{tr('البريد الإلكتروني', 'Email')}</label>
                <input className={`${input} cursor-not-allowed opacity-70`} value={me?.email ?? ''} readOnly dir='ltr' />
                <p className='mt-1 text-xs text-gray-400'>{tr('لتغيير البريد تواصل مع الدعم.', 'Contact support to change your email.')}</p>

                <button
                    onClick={saveName}
                    disabled={savingName || name.trim() === (me?.name ?? '').trim()}
                    className='mt-4 w-full rounded-xl bg-[#0B2923] px-4 py-2.5 text-sm font-bold text-[#00FFB2] hover:bg-[#0e3329] disabled:opacity-50 transition-colors'
                >
                    {savingName ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ الاسم', 'Save name')}
                </button>
            </div>

            {/* Change password */}
            <div className={card}>
                <h2 className='mb-4 font-bold text-[#0B2923]'>{tr('تغيير كلمة المرور', 'Change password')}</h2>
                <label className={label}>{tr('كلمة المرور الحالية', 'Current password')}</label>
                <input className={input} type='password' autoComplete='current-password' value={curPw} onChange={(e) => setCurPw(e.target.value)} />
                <label className={`${label} mt-4`}>{tr('كلمة المرور الجديدة', 'New password')}</label>
                <input className={input} type='password' autoComplete='new-password' value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <label className={`${label} mt-4`}>{tr('تأكيد كلمة المرور', 'Confirm new password')}</label>
                <input className={input} type='password' autoComplete='new-password' value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                <button
                    onClick={savePassword}
                    disabled={savingPw || !curPw || !newPw || !confirmPw}
                    className='mt-4 w-full rounded-xl border border-[#0B2923]/15 px-4 py-2.5 text-sm font-bold text-[#0B2923] hover:bg-black/5 disabled:opacity-50 transition-colors'
                >
                    {savingPw ? tr('جارٍ…', '…') : tr('تحديث كلمة المرور', 'Update password')}
                </button>
            </div>
        </div>
    )
}
