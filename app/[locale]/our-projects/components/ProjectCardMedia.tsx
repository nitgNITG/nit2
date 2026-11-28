'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { cloudinaryOptimized, skipOptimization } from '@/utils/cloudinaryUrl'
import { toShowcaseProject, type ShowcaseProject, type StoredProject } from '@/lib/promo'
import { usePromoLightbox } from '../../components/promo/PromoLightbox'
import { promoCopy } from '../../components/promo/promoCopy'
import { playExclusive, releaseTeaser, useTeaserAllowed } from '../../components/promo/teaser'
import { PlayIcon } from '../../components/promo/icons'

/** The section's projects that have a promo, for the lightbox's previous/next. */
export function promoPlaylist(projects: StoredProject[], locale: string): ShowcaseProject[] {
    return projects
        .filter((p) => p.promo?.videoUrl)
        .map((p) => toShowcaseProject({ ...p, title: p.title ?? p.titleEn ?? '', description: p.description ?? p.descriptionEn ?? '' }, locale))
        .filter((p) => p.promo)
}

const PAGE = 'our-projects'
const HOVER_DELAY = 150

/**
 * The image row of an Our Projects card. Cards without a promo look exactly as
 * before. With a promo: a "Watch promo" pill, a desktop hover preview (muted
 * teaser after ~150 ms, reverts on leave) and click/tap → lightbox.
 */
export default function ProjectCardMedia({ project, locale, playlist }: { project: StoredProject; locale: string; playlist?: ShowcaseProject[] }) {
    const title = (locale === 'en' ? project.titleEn : project.title) || project.title || project.titleEn || ''
    const image = (
        <Image
            src={cloudinaryOptimized(project.img, 600)}
            alt={title}
            unoptimized={skipOptimization(project.img)}
            width={600}
            height={400}
            sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
            className='w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300'
        />
    )
    if (!project.promo?.videoUrl) return <div className='overflow-hidden bg-gray-100 h-56 flex-shrink-0'>{image}</div>
    return <PromoCardMedia project={project} locale={locale} title={title} image={image} playlist={playlist} />
}

function PromoCardMedia({ project, locale, title, image, playlist }: { project: StoredProject; locale: string; title: string; image: React.ReactNode; playlist?: ShowcaseProject[] }) {
    const copy = promoCopy(locale)
    const lightbox = usePromoLightbox()
    const allowed = useTeaserAllowed()
    const view = toShowcaseProject({ ...project, title: project.title ?? title, description: project.description ?? '' }, locale)
    const promo = view.promo
    const videoRef = useRef<HTMLVideoElement>(null)
    const timer = useRef<ReturnType<typeof setTimeout>>()
    const [hovering, setHovering] = useState(false)
    const [progress, setProgress] = useState(0)
    const [finePointer, setFinePointer] = useState(false)

    const preview = allowed && finePointer

    useEffect(() => {
        setFinePointer(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
        return () => clearTimeout(timer.current)
    }, [])
    useEffect(() => {
        const video = videoRef.current
        return () => releaseTeaser(video)
    }, [preview])

    if (!promo) return <div className='overflow-hidden bg-gray-100 h-56 flex-shrink-0'>{image}</div>

    const enter = () => {
        if (!preview) return
        timer.current = setTimeout(() => {
            setHovering(true)
            if (videoRef.current) playExclusive(videoRef.current)
        }, HOVER_DELAY)
    }
    const leave = () => {
        clearTimeout(timer.current)
        setHovering(false)
        setProgress(0)
        const v = videoRef.current
        if (v) { releaseTeaser(v); v.currentTime = 0 }
    }

    return (
        <button
            type='button'
            onClick={(e) => lightbox.open(view, PAGE, e.currentTarget, playlist)}
            onMouseEnter={enter}
            onMouseLeave={leave}
            aria-label={`${copy.watchPromo}: ${title}`}
            className='relative block w-full overflow-hidden bg-gray-100 h-56 flex-shrink-0 text-start cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#00997A]'
        >
            {image}
            {preview && (
                <video
                    ref={videoRef}
                    muted
                    loop
                    playsInline
                    preload='none'
                    aria-hidden='true'
                    tabIndex={-1}
                    onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration) }}
                    className={`absolute inset-0 w-full h-full object-cover bg-[#0B2923] transition-opacity duration-200 ${hovering ? 'opacity-100' : 'opacity-0'}`}
                >
                    <source src={promo.teaserWebm} type='video/webm' />
                    <source src={promo.teaserMp4} type='video/mp4' />
                </video>
            )}
            <span className='absolute start-3 bottom-3 inline-flex items-center gap-2 ps-1.5 pe-3.5 py-1.5 rounded-full bg-[#0B2923] text-white text-[13px] font-bold'>
                <span className='size-[26px] rounded-full bg-[#00FFCD] flex items-center justify-center'>
                    <PlayIcon className='size-[11px]' />
                </span>
                {copy.watchPromo}
            </span>
            {hovering && (
                <span className='absolute inset-x-0 bottom-0 h-[3px] bg-white/15' aria-hidden='true'>
                    <span className='block h-full bg-[#00FFCD]' style={{ width: `${Math.round(progress * 100)}%` }} />
                </span>
            )}
        </button>
    )
}
