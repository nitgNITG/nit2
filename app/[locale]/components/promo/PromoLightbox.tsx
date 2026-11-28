'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ShowcaseProject } from '@/lib/promo'
import { contactHref, promoCopy } from './promoCopy'
import { trackPromo, type PromoEvent } from './promoAnalytics'
import { ChevronBackIcon, ChevronForwardIcon, CloseXIcon } from './icons'
import { suspendTeaser } from './teaser'

/** playlist: the projects previous/next moves through (defaults to just this one). */
type Ctx = { open: (project: ShowcaseProject, page: string, opener?: HTMLElement | null, playlist?: ShowcaseProject[]) => void }

const LightboxContext = createContext<Ctx>({ open: () => {} })

export const usePromoLightbox = () => useContext(LightboxContext)

const FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'

/** Progress milestones fire once each per opening. */
export function progressEvents(fraction: number, sent: Set<PromoEvent>): PromoEvent[] {
    const out: PromoEvent[] = []
    for (const [at, ev] of [[0.25, 'promo_progress_25'], [0.5, 'promo_progress_50'], [0.75, 'promo_progress_75']] as const) {
        if (fraction >= at && !sent.has(ev)) out.push(ev)
    }
    return out
}

/** Next/previous index in a playlist, wrapping around at both ends. */
export function stepPlaylist(length: number, index: number, dir: 1 | -1): number {
    return length ? (index + dir + length) % length : 0
}

type CaptionLang = 'en' | 'ar' | 'off'

/** The caption track to show first: the page's language when that track exists (spec §7). */
function defaultLang(p: ShowcaseProject, locale: string): CaptionLang {
    const { captionsEn: en, captionsAr: ar } = p.promo!
    return locale === 'ar' ? (ar ? 'ar' : en ? 'en' : 'off') : (en ? 'en' : ar ? 'ar' : 'off')
}

/**
 * One lightbox per page (spec §4). Wrap the page section(s) in this provider;
 * players and cards call usePromoLightbox().open(project, page, openerElement, playlist).
 * With a playlist of 2+, the dialog has previous/next buttons that switch the video
 * in place (the dialog stays open).
 */
export function PromoLightboxProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
    const [state, setState] = useState<{ list: ShowcaseProject[]; index: number; page: string } | null>(null)
    const opener = useRef<HTMLElement | null>(null)

    const open = useCallback<Ctx['open']>((project, page, el, playlist) => {
        if (!project.promo) return
        opener.current = el ?? (document.activeElement as HTMLElement | null)
        const list = (playlist ?? []).filter((p) => p.promo)
        const index = list.findIndex((p) => p.id === project.id)
        setState(index >= 0 ? { list, index, page } : { list: [project], index: 0, page })
        trackPromo('promo_open', project.slug, page)
    }, [])

    const close = useCallback(() => setState(null), [])

    const step = useCallback((dir: 1 | -1) => {
        setState((s) => (!s || s.list.length < 2 ? s : { ...s, index: stepPlaylist(s.list.length, s.index, dir) }))
    }, [])

    // Return focus to whatever opened the dialog, once it has unmounted. (Not rAF:
    // that never fires in a background tab.)
    const wasOpen = useRef(false)
    useEffect(() => {
        if (state) { wasOpen.current = true; return }
        if (!wasOpen.current) return
        wasOpen.current = false
        opener.current?.focus()
    }, [state])

    const value = useMemo(() => ({ open }), [open])

    return (
        <LightboxContext.Provider value={value}>
            {children}
            {state && <LightboxDialog list={state.list} index={state.index} page={state.page} locale={locale} onClose={close} onStep={step} />}
        </LightboxContext.Provider>
    )
}

type DialogProps = { list: ShowcaseProject[]; index: number; page: string; locale: string; onClose: () => void; onStep: (dir: 1 | -1) => void }

function LightboxDialog({ list, index, page, locale, onClose, onStep }: DialogProps) {
    const project = list[index]
    const promo = project.promo!
    const copy = promoCopy(locale)
    const dialogRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const sent = useRef(new Set<PromoEvent>())
    const hasCaptions = !!(promo.captionsEn || promo.captionsAr)
    const [lang, setLang] = useState<CaptionLang>(() => defaultLang(project, locale))
    const many = list.length > 1
    const prev = list[stepPlaylist(list.length, index, -1)]
    const next = list[stepPlaylist(list.length, index, 1)]

    // While open: the page behind doesn't scroll, Esc closes, Tab stays inside, and
    // only the promo plays (the teaser behind it resumes on close).
    useEffect(() => {
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
            if (e.key !== 'Tab' || !dialogRef.current) return
            const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
            if (items.length === 0) return
            const first = items[0]
            const last = items[items.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKey)
        const resumeTeaser = suspendTeaser()
        const video = videoRef.current
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
            // Pause and reset on close.
            if (video) { video.pause(); video.currentTime = 0 }
            resumeTeaser()
        }
    }, [onClose])

    // Each project (on open and on previous/next): fresh analytics milestones, its own
    // default captions, and start with sound right away (the click is the user gesture).
    const projectId = project.id
    // promo_open for the first project is sent by open(); later ones by this effect.
    const openedAt = useRef(index)
    useEffect(() => {
        sent.current = new Set()
        setLang(defaultLang(list[index], locale))
        if (index !== openedAt.current) trackPromo('promo_open', list[index].slug, page)
        openedAt.current = -1
        videoRef.current?.play()?.catch(() => { /* blocked → the native controls are there */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the shown project changes
    }, [projectId])

    // Show only the chosen caption track.
    useEffect(() => {
        const tracks = videoRef.current?.textTracks
        if (!tracks) return
        for (let i = 0; i < tracks.length; i++) tracks[i].mode = tracks[i].language === lang ? 'showing' : 'disabled'
    }, [lang, projectId])

    const onTime = () => {
        const v = videoRef.current
        if (!v || !v.duration) return
        for (const ev of progressEvents(v.currentTime / v.duration, sent.current)) {
            sent.current.add(ev)
            trackPromo(ev, project.slug, page)
        }
    }
    const onEnded = () => {
        if (sent.current.has('promo_complete')) return
        sent.current.add('promo_complete')
        trackPromo('promo_complete', project.slug, page)
    }

    const titleId = 'promo-dialog-title'
    return (
        // Scrolls (and centres with m-auto, not items-center) so the close button stays
        // reachable on short screens; the width is capped so the 16:9 video fits the height.
        <div
            className='fixed inset-0 z-[2147483100] flex overflow-y-auto bg-[rgba(4,16,14,.92)] p-4'
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div ref={dialogRef} role='dialog' aria-modal='true' aria-labelledby={titleId} dir={locale === 'ar' ? 'rtl' : 'ltr'}
                className='m-auto w-full max-w-[min(980px,calc((100svh_-_13rem)*16/9))] min-w-[min(100%,280px)] flex flex-col gap-3 md:gap-4 text-white'>
                <div className='flex justify-between items-center gap-4'>
                    <div className='flex flex-col min-w-0'>
                        {project.category && <span className='text-[13px] font-bold tracking-[.1em] text-[#00FFCD] uppercase'>{project.category}</span>}
                        <span id={titleId} className='text-xl md:text-2xl font-extrabold'>{project.title} — {copy.fullPromo}</span>
                        {many && <span className='text-sm text-white/60 tabular-nums' aria-live='polite'>{index + 1} / {list.length}</span>}
                    </div>
                    <button type='button' data-autofocus aria-label={copy.close} onClick={onClose}
                        className='shrink-0 size-12 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FFCD]'>
                        <CloseXIcon className='size-5' />
                    </button>
                </div>

                <div className='relative aspect-video w-full rounded-[14px] overflow-hidden border border-[rgba(0,255,205,.25)] bg-black'>
                    {/* Loads only now (the dialog isn't mounted before the click) and starts with sound. */}
                    <video
                        ref={videoRef}
                        src={promo.full}
                        poster={promo.poster}
                        controls
                        autoPlay
                        playsInline
                        preload='auto'
                        crossOrigin={hasCaptions ? 'anonymous' : undefined}
                        onTimeUpdate={onTime}
                        onEnded={onEnded}
                        className='absolute inset-0 w-full h-full object-contain'
                    >
                        {promo.captionsEn && <track key={`${projectId}-en`} kind='captions' srcLang='en' label='English' src={promo.captionsEn} default={lang === 'en'} />}
                        {promo.captionsAr && <track key={`${projectId}-ar`} kind='captions' srcLang='ar' label='العربية' src={promo.captionsAr} default={lang === 'ar'} />}
                    </video>
                    {many && (
                        <>
                            <StepButton side='start' label={copy.prevProject(prev.title)} onClick={() => onStep(-1)}>
                                <ChevronBackIcon className='size-6' />
                            </StepButton>
                            <StepButton side='end' label={copy.nextProject(next.title)} onClick={() => onStep(1)}>
                                <ChevronForwardIcon className='size-6' />
                            </StepButton>
                        </>
                    )}
                </div>

                <div className='flex flex-wrap justify-between items-center gap-3'>
                    {hasCaptions ? (
                        <div className='inline-flex items-center gap-3' role='group' aria-label={copy.captions}>
                            <span className='text-sm text-white/75'>{copy.captions}</span>
                            <div className='inline-flex border border-white/30 rounded-lg overflow-hidden'>
                                {promo.captionsEn && <CaptionBtn on={lang === 'en'} onClick={() => setLang('en')}>EN</CaptionBtn>}
                                {promo.captionsAr && <CaptionBtn on={lang === 'ar'} onClick={() => setLang('ar')}>عربي</CaptionBtn>}
                                <CaptionBtn on={lang === 'off'} onClick={() => setLang('off')}>{copy.captionsOff}</CaptionBtn>
                            </div>
                        </div>
                    ) : <span className='text-[15px] text-white/75'>{copy.wantLike(project.title)}</span>}
                    <a
                        href={contactHref(locale, project.title)}
                        onClick={() => trackPromo('promo_cta_click', project.slug, page)}
                        className='inline-flex items-center min-h-12 px-6 rounded-lg bg-gradient-to-b from-[#1E7D67] to-[#0B2923] border border-[rgba(0,255,205,.35)] font-bold text-white'
                    >
                        {copy.startSimilar}
                    </a>
                </div>
            </div>
        </div>
    )
}

/** Previous / next project, on the sides of the video. */
function StepButton({ side, label, onClick, children }: { side: 'start' | 'end'; label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type='button' aria-label={label} title={label} onClick={onClick}
            className={`absolute top-1/2 -translate-y-1/2 ${side === 'start' ? 'start-3' : 'end-3'} size-12 rounded-full bg-black/55 border border-white/30 text-white flex items-center justify-center hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FFCD]`}>
            {children}
        </button>
    )
}

function CaptionBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type='button' aria-pressed={on} onClick={onClick}
            className={`min-w-12 h-11 px-3 font-bold ${on ? 'bg-[#00FFCD] text-[#0B2923]' : 'bg-transparent text-white hover:bg-white/10'}`}>
            {children}
        </button>
    )
}
