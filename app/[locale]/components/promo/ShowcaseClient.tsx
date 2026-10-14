'use client'
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import type { ServiceKind, ShowcaseProject, ShowcaseState } from '@/lib/promo'
import { promoCopy } from './promoCopy'
import PromoPlayer from './PromoPlayer'
import ProjectDetails from './ProjectDetails'
import { usePromoLightbox } from './PromoLightbox'
import { ArrowOutIcon, PlayCircleIcon, PlayIcon } from './icons'

type Props = {
    projects: ShowcaseProject[]
    state: Exclude<ShowcaseState, 'hidden'>
    kind: ServiceKind
    fallbackCategory: string
    locale: string
    page: string
}

/**
 * The interactive part of the "Built by N.I.T" section:
 *   multi  → player + details + switcher (promo projects; each teaser plays once, then
 *            the next one); others in "Also built by us"
 *   single → the promo project leads; the rest in "Also built by us"
 *   static → screenshot frame instead of a player (no play button); switcher if 2+
 */
export default function ShowcaseClient({ projects, state, kind, fallbackCategory, locale, page }: Props) {
    const copy = promoCopy(locale)
    const lightbox = usePromoLightbox()
    const switchable = state === 'multi' ? projects.filter((p) => p.promo) : state === 'static' ? projects : []
    const others = state === 'static' ? [] : projects.filter((p) => (state === 'multi' ? !p.promo : p !== projects[0]))
    const [activeId, setActiveId] = useState((switchable[0] ?? projects[0]).id)
    const active = projects.find((p) => p.id === activeId) ?? projects[0]
    // Every promo in this section, for the lightbox's previous/next.
    const playlist = projects.filter((p) => p.promo)
    // 2+ promos: when a teaser finishes, the switcher moves on to the next project.
    const playNext = state === 'multi'
        ? () => setActiveId(switchable[(switchable.indexOf(active) + 1) % switchable.length].id)
        : undefined

    return (
        <div className='flex flex-col gap-10 md:gap-12'>
            <div className='flex flex-wrap gap-8 md:gap-12 items-center'>
                <div className='flex-[1_1_600px] min-w-0 flex flex-col gap-3.5'>
                    {active.promo ? (
                        <>
                            <PromoPlayer key={active.id} project={active} locale={locale} page={page} onEnded={playNext} playlist={playlist} />
                            <div className='flex flex-wrap justify-between items-center gap-3'>
                                <button type='button' onClick={(e) => lightbox.open(active, page, e.currentTarget, playlist)}
                                    className='inline-flex items-center gap-2.5 min-h-11 px-1 text-white text-base font-bold hover:text-[#00FFCD]'>
                                    <PlayCircleIcon className='size-[22px]' />
                                    {copy.watchFull}
                                </button>
                                {(active.promo.captionsEn || active.promo.captionsAr) && (
                                    <span className='inline-flex items-center gap-2 text-[13px] text-white/75'>
                                        <span className='px-2 py-0.5 rounded border border-white/20 font-bold'>CC</span>
                                        {[active.promo.captionsEn && 'English', active.promo.captionsAr && 'العربية'].filter(Boolean).join(' · ')}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <ScreenshotFrame project={active} kind={kind} label={kind === 'app' ? copy.screensApp : copy.screensWeb} />
                    )}
                </div>
                <div className='flex-[1_1_380px] min-w-0'>
                    <ProjectDetails project={active} locale={locale} page={page} fallbackCategory={fallbackCategory} />
                </div>
            </div>

            {switchable.length > 1 && (
                <div role='group' aria-label={copy.switcher}
                    className='flex lg:grid lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 md:gap-4 overflow-x-auto snap-x pb-1 -mx-4 px-4 lg:mx-0 lg:px-0'>
                    {switchable.map((p) => {
                        const on = p.id === active.id
                        return (
                            <button key={p.id} type='button' aria-pressed={on} onClick={() => setActiveId(p.id)}
                                className={`snap-start shrink-0 lg:shrink flex items-center gap-3.5 p-2.5 rounded-[14px] border-2 bg-white/5 text-white text-start min-w-[250px] lg:min-w-0 ${on ? 'border-[#00FFCD]' : 'border-white/20 hover:border-white/40'}`}>
                                <span className='relative shrink-0 w-24 md:w-[120px] aspect-video rounded-lg overflow-hidden bg-[#0B2923]'>
                                    <img src={p.promo?.thumb ?? p.img} alt='' loading='lazy' className='w-full h-full object-cover' />
                                    {p.promo && (
                                        <span className='absolute start-2 top-1/2 -translate-y-1/2 size-7 rounded-full bg-[#00FFCD] flex items-center justify-center'>
                                            <PlayIcon className='size-3' />
                                        </span>
                                    )}
                                </span>
                                <span className='flex flex-col gap-0.5 min-w-0'>
                                    <span className='text-[17px] font-extrabold truncate'>{p.title}</span>
                                    <span className='text-[13px] text-white/75 truncate'>{p.category || fallbackCategory}</span>
                                    {p.promo && (
                                        <span className='text-xs font-bold tracking-[.06em] text-[#00FFCD]'>{on ? copy.nowShowing : copy.watchPromo.toUpperCase()}</span>
                                    )}
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            {others.length > 0 && (
                <div className='flex flex-col gap-3.5'>
                    <div className='flex items-center gap-3.5'>
                        <span className='text-sm font-bold tracking-[.08em] text-white/75'>{copy.alsoBuilt}</span>
                        <span className='flex-1 h-px bg-white/20' />
                    </div>
                    <div className='grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4'>
                        {others.map((p) => {
                            const href = p.links[0]?.href
                            const inner = (
                                <>
                                    <span className='shrink-0 w-[120px] aspect-video rounded-lg overflow-hidden bg-[#E7ECEA]'>
                                        <img src={p.img} alt='' loading='lazy' className='w-full h-full object-contain' />
                                    </span>
                                    <span className='flex flex-col gap-0.5 min-w-0 flex-1'>
                                        <span className='text-[17px] font-extrabold'>{p.title}</span>
                                        <span className='text-[13px] text-white/75'>{p.category || fallbackCategory}</span>
                                    </span>
                                    {href && <ArrowOutIcon className='size-[18px] shrink-0' />}
                                </>
                            )
                            const cls = 'flex items-center gap-3.5 p-2.5 rounded-[14px] border border-white/20 bg-white/5 text-white'
                            return href
                                ? <a key={p.id} href={href} target='_blank' rel='noopener noreferrer' className={`${cls} hover:border-white/40`}>{inner}</a>
                                : <div key={p.id} className={cls}>{inner}</div>
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

/** 0 promos in the category: the project's own screenshot in a device/browser frame. */
function ScreenshotFrame({ project, kind, label }: { project: ShowcaseProject; kind: ServiceKind; label: string }) {
    return (
        <div className='relative aspect-video rounded-[18px] overflow-hidden border border-[rgba(0,255,205,.28)] shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)] bg-[#0B2923] bg-[linear-gradient(rgba(0,255,205,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,205,.07)_1px,transparent_1px)] bg-[length:32px_32px] flex items-center justify-center p-[6%] pt-[10%]'>
            <div className={`relative w-full h-full flex flex-col overflow-hidden bg-[#F4FBF9] shadow-[0_20px_40px_rgba(0,0,0,.4)] ${kind === 'app' ? 'max-w-[70%] rounded-[22px] border-[6px] border-[#1A4A40]' : 'rounded-xl border border-[#1A4A40]'}`}>
                {kind === 'web' && (
                    <div className='flex items-center gap-1.5 px-3 h-7 bg-[#1A4A40] shrink-0' aria-hidden='true'>
                        <span className='size-2 rounded-full bg-white/40' /><span className='size-2 rounded-full bg-white/40' /><span className='size-2 rounded-full bg-white/40' />
                    </div>
                )}
                <img src={project.img} alt={project.title} loading='lazy' className='flex-1 min-h-0 w-full object-contain p-2' />
            </div>
            <div className='absolute top-4 start-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(5,20,17,.7)] text-white text-xs font-semibold'>
                {label}
            </div>
        </div>
    )
}
