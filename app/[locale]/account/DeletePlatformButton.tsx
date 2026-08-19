'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'

export default function DeletePlatformButton({ slug, name }: { slug: string; name: string }) {
    const t = useTranslations('Admin')
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)

    // Close on Escape while the dialog is open (but never mid-delete).
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, busy])

    const onConfirm = async () => {
        if (busy) return
        setBusy(true)
        setError(false)
        try {
            const res = await fetch(`/api/academies/${slug}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(String(res.status))
            router.refresh() // drop the deleted platform from the list
        } catch {
            setError(true)
            setBusy(false)
        }
    }

    return (
        <>
            <button
                onClick={() => { setOpen(true); setError(false) }}
                className='inline-flex w-fit items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-300 hover:bg-red-500/25 transition-colors'
            >
                <TrashIcon className='h-4 w-4' />
                {t('delete')}
            </button>

            {open && (
                <div
                    className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-[fadeIn_120ms_ease-out]'
                    onClick={() => { if (!busy) setOpen(false) }}
                    role='dialog'
                    aria-modal='true'
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className='w-full max-w-sm rounded-3xl bg-[#0f342b] ring-1 ring-white/10 shadow-2xl p-6 text-white animate-[popIn_140ms_ease-out]'
                    >
                        {/* Icon */}
                        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/25'>
                            <TrashIcon className='h-7 w-7 text-red-300' />
                        </div>

                        {/* Copy */}
                        <h3 className='mt-4 text-center text-lg font-extrabold'>{t('deleteTitle')}</h3>
                        <p className='mt-2 text-center text-sm leading-relaxed text-white/60'>
                            {t('confirmDelete', { name })}
                        </p>

                        {error && (
                            <p className='mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300'>
                                {t('deleteFailed')}
                            </p>
                        )}

                        {/* Actions */}
                        <div className='mt-6 flex gap-3'>
                            <button
                                onClick={() => setOpen(false)}
                                disabled={busy}
                                className='flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 transition-colors disabled:opacity-50'
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={busy}
                                className='flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-600 transition-colors disabled:opacity-70'
                            >
                                {busy && <Spinner />}
                                {busy ? t('deleting') : t('delete')}
                            </button>
                        </div>
                    </div>

                    <style>{`
                        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                        @keyframes popIn { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: scale(1) } }
                    `}</style>
                </div>
            )}
        </>
    )
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M3 6h18' />
            <path d='M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2' />
            <path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
            <path d='M10 11v6' />
            <path d='M14 11v6' />
        </svg>
    )
}

function Spinner() {
    return (
        <svg className='h-4 w-4 animate-spin' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
            <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
            <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z' />
        </svg>
    )
}
