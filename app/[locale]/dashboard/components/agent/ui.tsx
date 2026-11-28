'use client'
// Small shared pieces for the AI-agent dashboard pages.
import React from 'react'
import clsx from 'clsx'

export async function api<T = any>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
    const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        cache: 'no-store',
    })
    let data: any = null
    try { data = await res.json() } catch { /* empty body */ }
    return { ok: res.ok, status: res.status, data }
}

export function errorText(r: { status: number; data: any }): string {
    if (r.status === 401) return 'Your session ended — sign in again.'
    if (r.status === 403) return 'You do not have permission for this.'
    return r.data?.message ?? `Request failed (${r.status})`
}

const TIER: Record<string, string> = {
    HOT: 'bg-red-100 text-red-700 border-red-200',
    WARM: 'bg-amber-100 text-amber-800 border-amber-200',
    COLD: 'bg-sky-100 text-sky-800 border-sky-200',
}
export function TierBadge({ tier }: { tier?: string | null }) {
    if (!tier) return <span className='text-gray-400'>—</span>
    return <span className={clsx('px-2 py-0.5 rounded border text-xs font-semibold', TIER[tier])}>{tier}</span>
}

const STATUS: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    waiting_human: 'bg-orange-100 text-orange-800',
    human: 'bg-purple-100 text-purple-800',
    closed: 'bg-gray-200 text-gray-700',
}
export const STATUS_LABEL: Record<string, string> = {
    open: 'AI answering', waiting_human: 'Waiting for a person', human: 'With a person', closed: 'Closed',
}
export function StatusBadge({ status }: { status: string }) {
    return <span className={clsx('px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', STATUS[status] ?? 'bg-gray-100')}>{STATUS_LABEL[status] ?? status}</span>
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
    return (
        <div className='flex flex-wrap gap-3 justify-between items-center'>
            <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>
                {title}
                {subtitle && <span className='block text-sm font-normal text-gray-500 mt-0.5'>{subtitle}</span>}
            </h4>
            {children}
        </div>
    )
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={clsx('bg-white rounded-lg shadow-sm p-4', className)}>{children}</div>
}

export const inputCls = 'border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500'
export const btnCls = 'px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed'
export const btnPrimary = clsx(btnCls, 'bg-blue-600 text-white hover:bg-blue-700')
export const btnGhost = clsx(btnCls, 'border border-gray-300 bg-white hover:bg-gray-50')

export function fmtDate(d: string | Date | null | undefined): string {
    if (!d) return '—'
    return new Date(d).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
