import React from 'react'
import prisma from '@/prisma/client'

export const dynamic = 'force-dynamic'

export default async function ClientsAdminPage() {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { academies: true } } },
    })

    const total = users.length
    const admins = users.filter((u) => (u.role ?? 'admin') === 'admin').length
    const clients = total - admins

    return (
        <div className='p-5 md:p-10' dir='ltr'>
            <h1 className='text-2xl font-extrabold text-gray-900'>Clients</h1>
            <p className='mt-1 text-gray-500'>Everyone who has registered on the site.</p>

            <div className='mt-6 grid max-w-2xl grid-cols-3 gap-4'>
                <Stat label='Total' value={total} />
                <Stat label='Clients' value={clients} accent />
                <Stat label='Admins' value={admins} />
            </div>

            <div className='mt-8 overflow-x-auto rounded-xl bg-white ring-1 ring-black/5'>
                <table className='w-full text-sm'>
                    <thead className='bg-gray-50 text-left text-gray-500'>
                        <tr>
                            <th className='px-4 py-3 font-semibold'>Name</th>
                            <th className='px-4 py-3 font-semibold'>Email</th>
                            <th className='px-4 py-3 font-semibold'>Role</th>
                            <th className='px-4 py-3 font-semibold'>Academies</th>
                            <th className='px-4 py-3 font-semibold'>Joined</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                        {users.length === 0 ? (
                            <tr><td colSpan={5} className='px-4 py-10 text-center text-gray-400'>No clients yet.</td></tr>
                        ) : users.map((u) => {
                            const role = (u.role ?? 'admin') as string
                            return (
                                <tr key={u.id} className='hover:bg-gray-50'>
                                    <td className='px-4 py-3 font-semibold text-gray-900'>
                                        {u.name || <span className='text-gray-300'>—</span>}
                                    </td>
                                    <td className='px-4 py-3 text-gray-700'>{u.email}</td>
                                    <td className='px-4 py-3'>
                                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                            role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                            {role}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 text-gray-700'>{u._count.academies}</td>
                                    <td className='px-4 py-3 text-gray-500'>
                                        {u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '—'}
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
