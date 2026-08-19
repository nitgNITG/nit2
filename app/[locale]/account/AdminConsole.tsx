import React from 'react'
import AdminAcademyStatus from './AdminAcademyStatus'

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export type AdminAcademy = { id: string; name: string; slug: string; status: string; owner: string | null }
export type AdminClient = { id: string; name: string | null; email: string; role: string; academies: number }

export default function AdminConsole({
    academies, clients, domain, adminName,
}: { academies: AdminAcademy[]; clients: AdminClient[]; domain: string; adminName: string }) {
    const live = academies.filter((a) => a.status === 'live').length

    return (
        <div className='bg-[#0B2923] text-white'>
            <div className='mx-auto max-w-6xl px-5 sm:px-8 py-10'>

                <header>
                    <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/70'>Admin · {adminName}</span>
                    <h1 className='mt-1 text-2xl font-extrabold'>All platforms &amp; clients</h1>
                </header>

                {/* Stats */}
                <div className='mt-6 grid max-w-2xl grid-cols-3 gap-4'>
                    <Stat label='Academies' value={academies.length} />
                    <Stat label='Live' value={live} accent />
                    <Stat label='Clients' value={clients.length} />
                </div>

                {/* Academies */}
                <h2 className='mt-10 text-lg font-extrabold'>Academies</h2>
                {academies.length === 0 ? (
                    <p className='mt-3 text-white/50'>No academies yet.</p>
                ) : (
                    <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {academies.map((a) => (
                            <div key={a.id} className='rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-5 flex flex-col gap-2'>
                                <AdminAcademyStatus slug={a.slug} initial={a.status} />
                                <p className='text-lg font-extrabold'>{a.name}</p>
                                <p dir='ltr' className='text-xs text-white/50 truncate' style={{ fontFamily: MONO }}>
                                    {a.slug}.{domain}
                                </p>
                                <p className='text-sm text-white/60'>{a.owner || '—'}</p>
                                <a
                                    href={`https://${a.slug}.${domain}`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='mt-1 inline-flex w-fit items-center gap-1 rounded-lg bg-[#00FFB2] px-3 py-1.5 text-sm font-bold text-[#0B2923]'
                                >
                                    Open ↗
                                </a>
                            </div>
                        ))}
                    </div>
                )}

                {/* Clients */}
                <h2 className='mt-10 text-lg font-extrabold'>Clients</h2>
                <div className='mt-4 overflow-x-auto rounded-2xl bg-white/[0.04] ring-1 ring-white/10'>
                    <table className='w-full text-sm' dir='ltr'>
                        <thead className='text-left text-white/50'>
                            <tr>
                                <th className='px-4 py-3 font-semibold'>Name</th>
                                <th className='px-4 py-3 font-semibold'>Email</th>
                                <th className='px-4 py-3 font-semibold'>Role</th>
                                <th className='px-4 py-3 font-semibold'>Academies</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-white/5'>
                            {clients.length === 0 ? (
                                <tr><td colSpan={4} className='px-4 py-8 text-center text-white/40'>No clients yet.</td></tr>
                            ) : clients.map((c) => (
                                <tr key={c.id}>
                                    <td className='px-4 py-3 font-semibold'>{c.name || <span className='text-white/30'>—</span>}</td>
                                    <td className='px-4 py-3 text-white/70'>{c.email}</td>
                                    <td className='px-4 py-3'>
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                            c.role === 'admin' ? 'bg-blue-400/20 text-blue-200' : 'bg-[#00FFB2]/15 text-[#00FFB2]'
                                        }`}>{c.role}</span>
                                    </td>
                                    <td className='px-4 py-3 text-white/70'>{c.academies}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className={`rounded-xl p-4 ring-1 ${accent ? 'bg-[#00FFB2]/10 ring-[#00FFB2]/20' : 'bg-white/[0.04] ring-white/10'}`}>
            <div className={`text-2xl font-extrabold ${accent ? 'text-[#00FFB2]' : 'text-white'}`}>{value}</div>
            <div className='text-xs text-white/60'>{label}</div>
        </div>
    )
}
