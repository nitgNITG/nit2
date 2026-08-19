'use client'

import React, { useState } from 'react'
import { useRouter } from '@/navigation'
import { useTranslations } from 'next-intl'

export default function DeletePlatformButton({ slug, name }: { slug: string; name: string }) {
    const t = useTranslations('Admin')
    const router = useRouter()
    const [busy, setBusy] = useState(false)

    const onDelete = async () => {
        if (busy) return
        if (!window.confirm(t('confirmDelete', { name }))) return
        setBusy(true)
        try {
            const res = await fetch(`/api/academies/${slug}`, { method: 'DELETE' })
            if (!res.ok) throw new Error(String(res.status))
            router.refresh() // drop the deleted platform from the list
        } catch {
            window.alert(t('deleteFailed'))
            setBusy(false)
        }
    }

    return (
        <button
            onClick={onDelete}
            disabled={busy}
            className='mt-1 inline-flex w-fit items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-bold text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50'
        >
            {busy ? t('deleting') : `🗑 ${t('delete')}`}
        </button>
    )
}
