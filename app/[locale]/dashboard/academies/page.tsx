'use client'

import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

type Academy = {
    id: string
    name: string
    slug: string
    branch: string
    tier: string
    status: 'branch_created' | 'provisioning' | 'live' | 'failed' | string
    createdAt: string
}

const TIER_COLOR: Record<string, string> = {
    demo: '#6b7686', basic: '#2563eb', standard: '#7c3aed', professional: '#b5811a',
}

// Where a live academy is served (subdomain scheme). Adjust when the server
// domain is finalized (subdomains first, path-folders as fallback).
const ACADEMY_DOMAIN = 'nitg-eg.com'

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
    branch_created: { label: 'Branch created', bg: '#3a3320', fg: '#e0b341' },
    provisioning: { label: 'Provisioning…', bg: '#1d2b3a', fg: '#5b9bef' },
    live: { label: 'Live', bg: '#13291d', fg: '#3fbe8b' },
    failed: { label: 'Failed', bg: '#2a1717', fg: '#f0736c' },
}

export default function DashboardAcademies() {
    const [rows, setRows] = useState<Academy[]>([])
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/academies', { params: { _: Date.now() } })
            setRows(Array.isArray(data.academies) ? data.academies : [])
            setErr(data.error || '')
        } catch (e: any) {
            setErr(e?.message || 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
        const t = setInterval(load, 10000)
        return () => clearInterval(t)
    }, [load])

    const counts = rows.reduce<Record<string, number>>((a, r) => {
        a[r.status] = (a[r.status] || 0) + 1
        return a
    }, {})

    return (
        <div style={{ padding: '28px', color: '#eef1f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>Academies</h1>
                    <p style={{ color: '#9aa3b0', margin: 0, fontSize: 14 }}>
                        {loading ? 'Loading…' : `${rows.length} total · ${counts.live || 0} live · ${counts.branch_created || 0} pending`}
                    </p>
                </div>
                <button onClick={load}
                    style={{ background: '#161a22', color: '#eef1f5', border: '1px solid #2b3240', borderRadius: 9, padding: '9px 15px', cursor: 'pointer', fontWeight: 600 }}>
                    ↻ Refresh
                </button>
            </div>

            {err && (
                <div style={{ marginBottom: 16, padding: '12px 15px', background: '#2a1717', border: '1px solid #5a2a2a', borderRadius: 9, color: '#f0736c', fontSize: 14 }}>
                    {err}
                </div>
            )}

            <div style={{ overflowX: 'auto', border: '1px solid #2b3240', borderRadius: 14 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
                    <thead>
                        <tr style={{ background: '#12151c', color: '#8a93a2', textAlign: 'left' }}>
                            <th style={{ padding: '12px 14px' }}>Academy</th>
                            <th style={{ padding: '12px 14px' }}>Branch</th>
                            <th style={{ padding: '12px 14px' }}>Status</th>
                            <th style={{ padding: '12px 14px' }}>Created</th>
                            <th style={{ padding: '12px 14px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((a) => {
                            const s = STATUS[a.status] || { label: a.status, bg: '#232a36', fg: '#aab3c0' }
                            return (
                                <tr key={a.id} style={{ borderTop: '1px solid #212836' }}>
                                    <td style={{ padding: '12px 14px' }}>
                                        <div style={{ fontWeight: 700 }}>{a.name}</div>
                                        <div style={{ color: '#6b7482', fontFamily: 'monospace', fontSize: 12.5 }}>{a.slug}</div>
                                    </td>
                                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12.5, color: '#8a93a2' }}>
                                        {a.branch}
                                        {a.tier && (
                                            <span style={{ marginInlineStart: 8, fontFamily: 'system-ui', fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: '#fff', background: TIER_COLOR[a.tier] || '#6b7686', padding: '2px 8px', borderRadius: 999 }}>
                                                {a.tier}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: s.fg, background: s.bg, padding: '4px 10px', borderRadius: 999 }}>{s.label}</span>
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#8a93a2' }}>
                                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                        {a.status === 'live' && (
                                            <a href={`https://${a.slug}.${ACADEMY_DOMAIN}`} target="_blank" rel="noreferrer"
                                                style={{ color: '#5b9bef', textDecoration: 'none', fontWeight: 600 }}>
                                                Open →
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#8a93a2' }}>No academies yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
