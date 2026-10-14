'use client'
import type { ShowcaseProject } from '@/lib/promo'
import { contactHref, promoCopy } from './promoCopy'
import { ArrowOutIcon } from './icons'
import { trackPromo } from './promoAnalytics'

type Props = {
    project: ShowcaseProject
    locale: string
    page: string
    fallbackCategory?: string
    /** dark = service section; light = Our Projects Featured band */
    tone?: 'dark' | 'light'
    ctaLabel?: string
    showChips?: boolean
}

/** Category · name · description · chips · key results · CTA + store/web links. */
export default function ProjectDetails({ project, locale, page, fallbackCategory, tone = 'dark', ctaLabel, showChips = true }: Props) {
    const copy = promoCopy(locale)
    const dark = tone === 'dark'
    const muted = dark ? 'text-white/75' : 'text-[#46524F]'
    const category = project.category || fallbackCategory
    return (
        <div className='flex flex-col gap-4 md:gap-[18px] min-w-0'>
            {category && (
                <div className={`text-[13px] md:text-sm font-bold tracking-[.08em] ${dark ? 'text-[#00FFCD]' : 'text-[#00795F]'}`}>{category}</div>
            )}
            <h3 className={`m-0 font-extrabold leading-[1.1] ${dark ? 'text-[28px] md:text-4xl' : 'text-2xl md:text-[32px]'}`}>{project.title}</h3>
            <p className={`m-0 text-[15px] md:text-base leading-[1.75] line-clamp-3 ${muted}`}>{project.description}</p>

            {showChips && project.features.length > 0 && (
                <ul className='flex flex-wrap gap-2 list-none p-0 m-0'>
                    {project.features.map((f) => (
                        <li key={f} className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${dark ? 'bg-white/5 border-white/20' : 'bg-[#F2F3FA] border-[#D5DBE5]'}`}>{f}</li>
                    ))}
                </ul>
            )}

            {project.keyResults.length > 0 && (
                <dl className='grid grid-cols-2 gap-3 m-0'>
                    {project.keyResults.map((k) => (
                        <div key={k.value + k.label} className={`px-4 py-3.5 rounded-xl border ${dark ? 'bg-white/5 border-white/20' : 'bg-[#F2F3FA] border-[#E3E8EE]'}`}>
                            <dt className={`text-[22px] font-extrabold ${dark ? 'text-[#00FFCD]' : 'text-[#00795F]'}`}>{k.value}</dt>
                            <dd className={`m-0 text-[13px] ${muted}`}>{k.label}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <div className='flex flex-wrap gap-2.5 mt-1'>
                <a
                    href={contactHref(locale, project.title)}
                    onClick={() => trackPromo('promo_cta_click', project.slug, page)}
                    className={`inline-flex items-center min-h-12 px-6 rounded-lg bg-gradient-to-b from-[#1E7D67] to-[#0B2923] text-white font-bold ${dark ? 'border border-[rgba(0,255,205,.35)]' : ''}`}
                >
                    {ctaLabel ?? copy.startSimilar}
                </a>
                {project.links.map((l) => (
                    <a key={l.href} href={l.href} target='_blank' rel='noopener noreferrer'
                        className={`inline-flex items-center gap-2 min-h-12 px-[18px] rounded-lg border font-semibold ${dark ? 'border-white/20 text-white hover:bg-white/5' : 'border-[#D5DBE5] text-[#0B2923] hover:bg-[#F2F3FA]'}`}>
                        <ArrowOutIcon className='size-[18px]' />
                        {l.label}
                    </a>
                ))}
            </div>
        </div>
    )
}
