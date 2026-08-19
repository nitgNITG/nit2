import React from 'react'
import { getTranslations } from 'next-intl/server'
import AdminAcademyStatus from './AdminAcademyStatus'
import DeletePlatformButton from './DeletePlatformButton'

const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"

export type AdminAcademy = { id: string; name: string; slug: string; status: string; ownerId: string | null; owner: string | null }
export type AdminClient = { id: string; name: string | null; email: string; role: string; academies: number }

export default async function AdminConsole({
    academies, clients, domain, adminName,
}: { academies: AdminAcademy[]; clients: AdminClient[]; domain: string; adminName: string }) {
    const t = await getTranslations('Admin')
    const live = academies.filter((a) => a.status === 'live').length

    // Group every platform under the client who owns it. Platforms whose owner is
    // missing (legacy/test rows) fall into a trailing "unassigned" group.
    const byOwner = new Map<string, AdminAcademy[]>()
    for (const a of academies) {
        const key = a.ownerId ?? '__none__'
        const list = byOwner.get(key) ?? []
        list.push(a)
        byOwner.set(key, list)
    }
    const orphans = byOwner.get('__none__') ?? []

    return (
        <div className='bg-[#0B2923] text-white'>
            <div className='mx-auto max-w-6xl px-5 sm:px-8 py-10'>

                <header>
                    <span className='text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/70'>{t('role')} · {adminName}</span>
                    <h1 className='mt-1 text-2xl font-extrabold'>{t('title')}</h1>
                </header>

                {/* Stats */}
                <div className='mt-6 grid max-w-2xl grid-cols-3 gap-4'>
                    <Stat label={t('statAcademies')} value={academies.length} />
                    <Stat label={t('statLive')} value={live} accent />
                    <Stat label={t('statClients')} value={clients.length} />
                </div>

                {/* Clients, each with their platforms beneath */}
                <h2 className='mt-10 text-lg font-extrabold'>{t('clientsHeading')}</h2>

                {clients.length === 0 ? (
                    <p className='mt-3 text-white/50'>{t('noClients')}</p>
                ) : (
                    <div className='mt-4 flex flex-col gap-5'>
                        {clients.map((c) => {
                            const platforms = byOwner.get(c.id) ?? []
                            return (
                                <ClientGroup
                                    key={c.id}
                                    title={c.name || c.email}
                                    subtitle={c.name ? c.email : null}
                                    role={c.role === 'admin' ? t('roleAdmin') : t('roleClient')}
                                    isAdmin={c.role === 'admin'}
                                    countLabel={t('platformsCount', { n: platforms.length })}
                                    platforms={platforms}
                                    domain={domain}
                                    emptyLabel={t('noPlatforms')}
                                    openLabel={t('open')}
                                />
                            )
                        })}

                        {/* Platforms with no known owner */}
                        {orphans.length > 0 && (
                            <ClientGroup
                                title={t('unassigned')}
                                subtitle={null}
                                role={null}
                                isAdmin={false}
                                countLabel={t('platformsCount', { n: orphans.length })}
                                platforms={orphans}
                                domain={domain}
                                emptyLabel={t('noPlatforms')}
                                openLabel={t('open')}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function ClientGroup({
    title, subtitle, role, isAdmin, countLabel, platforms, domain, emptyLabel, openLabel,
}: {
    title: string
    subtitle: string | null
    role: string | null
    isAdmin: boolean
    countLabel: string
    platforms: AdminAcademy[]
    domain: string
    emptyLabel: string
    openLabel: string
}) {
    return (
        <section className='rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-5'>
            {/* Client header */}
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <span className='text-base font-extrabold'>{title}</span>
                {role && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isAdmin ? 'bg-blue-400/20 text-blue-200' : 'bg-[#00FFB2]/15 text-[#00FFB2]'
                    }`}>{role}</span>
                )}
                <span className='text-xs text-white/40'>· {countLabel}</span>
                {subtitle && <span dir='ltr' className='w-full text-xs text-white/50' style={{ fontFamily: MONO }}>{subtitle}</span>}
            </div>

            {/* This client's platforms */}
            {platforms.length === 0 ? (
                <p className='mt-4 text-sm text-white/40'>{emptyLabel}</p>
            ) : (
                <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    {platforms.map((a) => (
                        <div key={a.id} className='rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5 flex flex-col gap-2'>
                            <AdminAcademyStatus slug={a.slug} initial={a.status} />
                            <p className='text-lg font-extrabold'>{a.name}</p>
                            <p dir='ltr' className='text-xs text-white/50 truncate' style={{ fontFamily: MONO }}>
                                {a.slug}.{domain}
                            </p>
                            <div className='mt-1 flex flex-wrap items-center gap-2'>
                                <a
                                    href={`https://${a.slug}.${domain}`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='inline-flex w-fit items-center gap-1 rounded-lg bg-[#00FFB2] px-3 py-1.5 text-sm font-bold text-[#0B2923]'
                                >
                                    {openLabel} ↗
                                </a>
                                <DeletePlatformButton slug={a.slug} name={a.name} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
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
