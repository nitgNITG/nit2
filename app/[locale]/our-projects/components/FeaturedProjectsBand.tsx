'use client'
import { useState } from 'react'
import type { ShowcaseProject } from '@/lib/promo'
import PromoPlayer from '../../components/promo/PromoPlayer'
import ProjectDetails from '../../components/promo/ProjectDetails'
import { contactHref, promoCopy } from '../../components/promo/promoCopy'
import { trackPromo } from '../../components/promo/promoAnalytics'

const PAGE = 'our-projects'

/**
 * Featured band under the Our Projects hero (spec §6). The page only renders it
 * when there is at least one featured project with a promo:
 *   1   → player (looping teaser) + that project's details
 *   2–3 → player + vertical tabs (number · label · name · progress) + CTA; each
 *         teaser plays once and the band moves on to the next project
 */
export default function FeaturedProjectsBand({ projects, locale }: { projects: ShowcaseProject[]; locale: string }) {
    const copy = promoCopy(locale)
    const [activeId, setActiveId] = useState(projects[0]?.id)
    const [progress, setProgress] = useState(0)
    const active = projects.find((p) => p.id === activeId) ?? projects[0]
    if (!active) return null
    const many = projects.length > 1
    const select = (id: string) => { setActiveId(id); setProgress(0) }
    // 2-3 projects: when a teaser finishes, move on to the next tab (wrapping around).
    const playNext = () => select(projects[(projects.indexOf(active) + 1) % projects.length].id)

    return (
        <section aria-labelledby='featured-title' className='relative z-10 px-4 sm:px-6 pb-16 md:pb-20'>
            <div className='max-w-[1200px] mx-auto -mt-[150px] bg-white text-[#0B2923] rounded-3xl p-5 md:p-7 shadow-[0_30px_70px_-30px_rgba(11,41,35,.45)] flex flex-col gap-5'>
                <div className='flex flex-wrap justify-between items-end gap-2'>
                    <div className='flex flex-col gap-0.5'>
                        <span className='text-[13px] font-bold tracking-[.12em] text-[#00795F]'>{copy.featuredEyebrow}</span>
                        <h2 id='featured-title' className='m-0 text-2xl md:text-[28px] font-extrabold'>
                            {many ? copy.featuredTitleMany(projects.length) : copy.featuredTitleOne}
                        </h2>
                    </div>
                </div>

                <div className='flex flex-wrap gap-6 items-stretch'>
                    <div className='flex-[1_1_640px] min-w-0'>
                        <PromoPlayer key={active.id} project={active} locale={locale} page={PAGE} priority rounded='rounded-2xl'
                            onProgress={setProgress} onEnded={many ? playNext : undefined} playlist={projects} />
                    </div>

                    {many ? (
                        <div role='tablist' aria-label={copy.featuredTabs} className='flex-[1_1_300px] min-w-0 flex flex-col gap-2.5'>
                            {projects.map((p, i) => {
                                const on = p.id === active.id
                                return (
                                    <button key={p.id} type='button' role='tab' aria-selected={on}
                                        onClick={() => select(p.id)}
                                        className={`flex-1 flex flex-col justify-center gap-1 min-h-[88px] px-[18px] py-3.5 rounded-[14px] border-2 text-start ${on ? 'border-[#00997A] bg-[#F0FBF8]' : 'border-[#E3E8EE] bg-white hover:border-[#00997A]/50'}`}>
                                        <span className='text-xs font-bold tracking-[.08em] text-[#00795F]'>
                                            {String(i + 1).padStart(2, '0')}{p.category ? ` · ${p.category}` : ''}
                                        </span>
                                        <span className='text-lg md:text-xl font-extrabold'>{p.title}</span>
                                        <span className='block w-full h-[3px] rounded-sm bg-[#E3E8EE]' aria-hidden='true'>
                                            <span className='block h-full rounded-sm bg-[#00997A]' style={{ width: `${on ? Math.round(progress * 100) : 0}%` }} />
                                        </span>
                                    </button>
                                )
                            })}
                            <a href={contactHref(locale, active.title)} onClick={() => trackPromo('promo_cta_click', active.slug, PAGE)}
                                className='inline-flex items-center justify-center min-h-12 rounded-[10px] bg-gradient-to-b from-[#1E7D67] to-[#0B2923] text-white font-bold'>
                                {copy.startLikeThis}
                            </a>
                        </div>
                    ) : (
                        <div className='flex-[1_1_300px] min-w-0 flex flex-col justify-center'>
                            <ProjectDetails project={active} locale={locale} page={PAGE} tone='light' ctaLabel={copy.startLikeThis} showChips={false} />
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
