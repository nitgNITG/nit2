import React from 'react'
// Academies live in MySQL; their owners are Users in the Mongo app DB.
import prismaMysql from '@/lib/prismaMysql'
import prisma from '@/prisma/client'
import AdminAcademyStatus from './AdminAcademyStatus'

const DOMAIN = process.env.SAAS_CLIENT_DOMAIN ?? 'academy2026.nitg-eg.com'
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export const dynamic = 'force-dynamic'

export default async function AcademiesAdminPage() {
    const academies = await prismaMysql.academy.findMany({ orderBy: { createdAt: 'desc' } })

    // Join owners across databases: collect ownerIds → look the Users up in Mongo → map by id.
    // Tolerant of Mongo being unreachable — the page still renders (owner shows "—").
    const ownerIds = Array.from(new Set(academies.map((a) => a.ownerId).filter(Boolean) as string[]))
    let ownerById = new Map<string, { name: string | null; email: string }>()
    if (ownerIds.length) {
        try {
            const owners = await prisma.user.findMany({
                where: { id: { in: ownerIds } },
                select: { id: true, name: true, email: true },
            })
            ownerById = new Map(owners.map((u) => [u.id, { name: u.name, email: u.email }]))
        } catch (e) {
            console.error('[dashboard/academies] owner lookup failed', e)
        }
    }

    const total = academies.length
    const liveCount = academies.filter((a) => a.status === 'live').length
    const clients = new Set(academies.filter((a) => a.ownerId).map((a) => a.ownerId)).size

    return (
        <div className='p-5 md:p-10' dir='ltr'>
            <h1 className='text-2xl font-extrabold text-gray-900'>Academies</h1>
            <p className='mt-1 text-gray-500'>Every academy created from the site, and who owns it.</p>

            <div className='mt-6 grid max-w-2xl grid-cols-3 gap-4'>
                <Stat label='Academies' value={total} />
                <Stat label='Live' value={liveCount} accent />
                <Stat label='Clients' value={clients} />
            </div>

            <div className='mt-8 overflow-x-auto rounded-xl bg-white ring-1 ring-black/5'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-50 text-left text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 font-semibold'>Academy</th>
                            <th className='px-4 py-3 font-semibold'>Tier</th>
                            <th className='px-4 py-3 font-semibold'>Owner</th>
                            <th className='px-4 py-3 font-semibold'>Status</th>
                            <th className='px-4 py-3 font-semibold'>Created</th>
                            <th className='px-4 py-3 font-semibold'>Link</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                        {academies.length === 0 ? (
                            <tr><td colSpan={6} className='px-4 py-10 text-center text-gray-400'>No academies yet.</td></tr>
                        ) : academies.map((a) => {
                            const owner = a.ownerId ? ownerById.get(a.ownerId) : null
                            return (
                                <tr key={a.id} className='hover:bg-gray-50'>
                                    <td className='px-4 py-3'>
                                        <div className='font-semibold text-gray-900'>{a.name}</div>
                                        <div className='text-xs text-gray-400' style={{ fontFamily: MONO }}>{a.slug}</div>
                                    </td>
                                    <td className='px-4 py-3'><TierBadge tier={a.tier} /></td>
                                    <td className='px-4 py-3 text-gray-700'>
                                        {owner?.name || owner?.email || <span className='text-gray-300'>—</span>}
                                    </td>
                                    <td className='px-4 py-3'><AdminAcademyStatus slug={a.slug} initial={a.status} /></td>
                                    <td className='px-4 py-3 text-gray-500'>{a.createdAt.toISOString().slice(0, 10)}</td>
                                    <td className='px-4 py-3'>
                                        <a href={`https://${a.slug}.${DOMAIN}`} target='_blank' rel='noopener noreferrer'
                                           className='font-semibold text-[#1E7D67] hover:underline'>Open ↗</a>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className={`rounded-xl p-4 ring-1 ring-black/5 ${accent ? 'bg-[#0B2923]' : 'bg-white'}`}>
            <div className={`text-2xl font-extrabold ${accent ? 'text-[#00FFB2]' : 'text-gray-900'}`}>{value}</div>
            <div className={`text-xs ${accent ? 'text-white/60' : 'text-gray-500'}`}>{label}</div>
        </div>
    )
}

function TierBadge({ tier }: { tier: string }) {
    const colors: Record<string, string> = {
        demo: 'bg-gray-100 text-gray-600',
        basic: 'bg-blue-50 text-blue-700',
        standard: 'bg-amber-50 text-amber-700',
        professional: 'bg-emerald-50 text-emerald-700',
    }
    const cls = colors[tier] ?? 'bg-gray-100 text-gray-600'
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>{tier}</span>
}
