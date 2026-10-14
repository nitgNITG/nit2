'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { ShowcaseProject } from '@/lib/promo'
import { promoCopy } from './promoCopy'
import { playExclusive, releaseTeaser, useTeaserAllowed } from './teaser'
import { usePromoLightbox } from './PromoLightbox'
import { trackPromo } from './promoAnalytics'
import { PlayIcon } from './icons'

type Props = {
    project: ShowcaseProject
    locale: string
    page: string
    /** Above the fold (Featured band) → load the poster eagerly. */
    priority?: boolean
    rounded?: string
    /** Teaser progress 0–1, e.g. for the Featured band's active tab. */
    onProgress?: (p: number) => void
    /** Set when there are several projects: the teaser plays once, then this moves on (no loop). */
    onEnded?: () => void
    /** The projects the lightbox's previous/next buttons move through. */
    playlist?: ShowcaseProject[]
}

/**
 * Poster → muted teaser (starts at ≥ 50 % visible, pauses off-screen, one at a time;
 * loops unless onEnded is set) + big play button that opens the full promo with sound
 * in the lightbox.
 */
export default function PromoPlayer({ project, locale, page, priority, rounded = 'rounded-[18px]', onProgress, onEnded, playlist }: Props) {
    const promo = project.promo!
    const copy = promoCopy(locale)
    const allowed = useTeaserAllowed()
    const lightbox = usePromoLightbox()
    const boxRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const viewed = useRef(false)
    const [progress, setProgress] = useState(0)
    const [running, setRunning] = useState(false)

    useEffect(() => {
        const box = boxRef.current
        const video = videoRef.current
        if (!allowed || !box || !video) return
        const io = new IntersectionObserver(([entry]) => {
            if (entry.intersectionRatio >= 0.5) {
                playExclusive(video)
                if (!viewed.current) {
                    viewed.current = true
                    trackPromo('promo_teaser_view', project.slug, page)
                }
            } else {
                releaseTeaser(video)
            }
        }, { threshold: [0, 0.5, 1] })
        io.observe(box)
        return () => { io.disconnect(); releaseTeaser(video) }
    }, [allowed, project.slug, page])

    const onTime = () => {
        const v = videoRef.current
        if (!v || !v.duration) return
        const p = v.currentTime / v.duration
        setProgress(p)
        onProgress?.(p)
    }

    return (
        <div
            ref={boxRef}
            className={`relative aspect-video overflow-hidden ${rounded} border border-[rgba(0,255,205,.28)] bg-[#0B2923] shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)]`}
        >
            <Image
                src={promo.poster}
                alt={project.title}
                fill
                unoptimized
                priority={priority}
                loading={priority ? undefined : 'lazy'}
                sizes='(max-width: 1030px) 100vw, 640px'
                className='object-contain'
            />
            {allowed && (
                <video
                    ref={videoRef}
                    muted
                    loop={!onEnded}
                    onEnded={onEnded}
                    playsInline
                    preload='none'
                    poster={promo.poster}
                    aria-hidden='true'
                    tabIndex={-1}
                    onPlaying={() => setRunning(true)}
                    onPause={() => setRunning(false)}
                    onTimeUpdate={onTime}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${running ? 'opacity-100' : 'opacity-0'}`}
                >
                    <source src={promo.teaserWebm} type='video/webm' />
                    <source src={promo.teaserMp4} type='video/mp4' />
                </video>
            )}

            {running && (
                <div className='absolute top-4 start-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(5,20,17,.7)] text-white text-xs font-semibold'>
                    <span className='size-[7px] rounded-full bg-[#00FFCD]' />
                    {copy.previewChip}
                </div>
            )}

            <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                <button
                    type='button'
                    aria-label={copy.playFull}
                    onClick={(e) => lightbox.open(project, page, e.currentTarget, playlist)}
                    className='pointer-events-auto size-16 md:size-20 rounded-full border-[6px] border-[rgba(0,255,205,.25)] bg-[#00FFCD] bg-clip-padding flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,.35)] hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white transition-transform'
                >
                    <PlayIcon className='size-6 md:size-7' />
                </button>
            </div>

            <div className='absolute inset-x-0 bottom-0 h-1 bg-white/15' aria-hidden='true'>
                <div className='h-full bg-[#00FFCD] ltr:origin-left rtl:origin-right' style={{ transform: `scaleX(${running ? progress : 0})` }} />
            </div>
        </div>
    )
}
