/* eslint-disable @next/next/no-img-element */
'use client'
import React, { useMemo, useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
    LuPlay, LuClock, LuSearch, LuSparkles, LuX, LuShare2, LuArrowRight,
    LuArrowLeft, LuCheck, LuLayers, LuFilm
} from 'react-icons/lu'
import { parseVideoUrl, VIDEO_CATEGORIES } from '@/lib/videos'
import LocaleLink from '../../components/LocaleLink'

export interface VideoData {
    id: string
    title: string
    titleEn?: string | null
    description?: string | null
    descriptionEn?: string | null
    videoUrl: string
    thumbnailUrl?: string | null
    duration?: string | null
    durationSec?: number | null
    category?: string | null
    order: number
    isFeatured: boolean
    createdAt: string | Date
}

export default function VideosShowcase({ initialVideos }: { initialVideos: VideoData[] }) {
    const t = useTranslations('videos')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeVideo, setActiveVideo] = useState<VideoData | null>(null)
    const [copied, setCopied] = useState(false)

    // Close modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActiveVideo(null)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Prevent body scrolling when video modal is open
    useEffect(() => {
        if (activeVideo) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => { document.body.style.overflow = 'auto' }
    }, [activeVideo])

    // Find featured spotlight video (first featured one, or first overall if none marked featured)
    const spotlightVideo = useMemo(() => {
        return initialVideos.find((v) => v.isFeatured) || initialVideos[0] || null
    }, [initialVideos])

    // Filter videos by category and search
    const filteredVideos = useMemo(() => {
        return initialVideos.filter((v) => {
            const matchesCat = selectedCategory === 'all' || v.category === selectedCategory
            const q = searchQuery.toLowerCase().trim()
            const titleMatch = v.title?.toLowerCase().includes(q) ||
                (v.titleEn && v.titleEn.toLowerCase().includes(q))
            const descMatch = v.description?.toLowerCase().includes(q) ||
                (v.descriptionEn && v.descriptionEn.toLowerCase().includes(q))
            return matchesCat && (!q || titleMatch || descMatch)
        })
    }, [initialVideos, selectedCategory, searchQuery])

    const copyShareLink = (video: VideoData) => {
        if (typeof window !== 'undefined') {
            const url = `${window.location.origin}/${locale}/videos?v=${video.id}`
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const getLocalizedTitle = (v: VideoData) => {
        if (!isAr && v.titleEn) return v.titleEn
        return v.title || v.titleEn || ''
    }

    const getLocalizedDesc = (v: VideoData) => {
        if (!isAr && v.descriptionEn) return v.descriptionEn
        return v.description || v.descriptionEn || ''
    }

    return (
        <section className='p-container py-12 lg:py-16' dir={isAr ? 'rtl' : 'ltr'}>
            
            {/* ── 1. Featured Spotlight Video Banner (when available & no search active) ── */}
            {spotlightVideo && !searchQuery && selectedCategory === 'all' && (
                <div className='mb-14'>
                    <div className='relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0F1922] via-[#14232C] to-[#0D281E] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]'>
                        
                        {/* Glow ambient background */}
                        <div className='absolute -right-20 -top-20 w-96 h-96 bg-[#00FFCD]/10 rounded-full blur-3xl pointer-events-none' />
                        <div className='absolute -left-20 -bottom-20 w-96 h-96 bg-[#1E7D67]/20 rounded-full blur-3xl pointer-events-none' />

                        <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-6 sm:p-8 lg:p-10 items-center relative z-10'>
                            
                            {/* Left/Right Text Info */}
                            <div className='lg:col-span-5 space-y-4'>
                                <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[#00FFB2] text-xs font-bold uppercase tracking-wider'>
                                    <LuSparkles className='size-3.5' />
                                    <span>{t('featured')}</span>
                                </div>

                                <h2 className='text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight'>
                                    {getLocalizedTitle(spotlightVideo)}
                                </h2>

                                {getLocalizedDesc(spotlightVideo) && (
                                    <p className='text-white/75 text-sm sm:text-base leading-relaxed line-clamp-3'>
                                        {getLocalizedDesc(spotlightVideo)}
                                    </p>
                                )}

                                <div className='pt-2 flex flex-wrap items-center gap-4 text-xs text-white/60'>
                                    {spotlightVideo.duration && (
                                        <span className='flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg'>
                                            <LuClock className='size-3.5 text-[#00FFB2]' />
                                            <span>{spotlightVideo.duration}</span>
                                        </span>
                                    )}
                                    <span className='capitalize bg-white/10 px-3 py-1.5 rounded-lg'>
                                        {VIDEO_CATEGORIES.find((c) => c.key === spotlightVideo.category)?.[isAr ? 'labelAr' : 'labelEn'] || spotlightVideo.category}
                                    </span>
                                </div>

                                <div className='pt-2'>
                                    <button
                                        onClick={() => setActiveVideo(spotlightVideo)}
                                        className='inline-flex items-center gap-2.5 bg-[#00FFB2] hover:bg-[#00e6a1] text-gray-950 font-bold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(0,255,178,0.4)] hover:scale-105 active:scale-95'
                                    >
                                        <LuPlay className='size-4 fill-current' />
                                        <span>{t('watch')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Video Preview Card with Pulsing Play Ring */}
                            <div className='lg:col-span-7'>
                                <div
                                    onClick={() => setActiveVideo(spotlightVideo)}
                                    className='relative aspect-video rounded-2xl overflow-hidden cursor-pointer group shadow-2xl border border-white/15 bg-black'
                                >
                                    <img
                                        src={spotlightVideo.thumbnailUrl || parseVideoUrl(spotlightVideo.videoUrl).thumbnailUrl || '/assets/default_thumb.jpg'}
                                        alt={spotlightVideo.title}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                                    />
                                    
                                    {/* Dark Gradient Overlay */}
                                    <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/60 transition-colors' />

                                    {/* Big Glowing Play Button with Pulse Effect */}
                                    <div className='absolute inset-0 flex items-center justify-center'>
                                        <div className='relative flex items-center justify-center'>
                                            <div className='absolute size-20 rounded-full bg-[#00FFCD]/30 animate-ping' />
                                            <div className='size-16 sm:size-20 rounded-full bg-[#00FFB2] text-gray-950 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,178,0.6)] group-hover:scale-110 transition-transform'>
                                                <LuPlay className='size-7 sm:size-8 fill-current translate-x-0.5' />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── 2. Category Filters & Search Bar ── */}
            <div className='flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-10 pb-5 border-b border-gray-100'>
                
                {/* Category Pills */}
                <div className='flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none'>
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`text-xs md:text-sm px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-[#1E7D67] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {t('all')}
                        <span className='ms-1.5 opacity-70 text-xs font-normal'>({initialVideos.length})</span>
                    </button>

                    {VIDEO_CATEGORIES.map((cat) => {
                        const count = initialVideos.filter((v) => v.category === cat.key).length
                        if (count === 0 && selectedCategory !== cat.key) return null
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setSelectedCategory(cat.key)}
                                className={`text-xs md:text-sm px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${selectedCategory === cat.key ? 'bg-[#1E7D67] text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {isAr ? cat.labelAr : cat.labelEn}
                                <span className='ms-1.5 opacity-70 text-xs font-normal'>({count})</span>
                            </button>
                        )
                    })}
                </div>

                {/* Search Bar */}
                <div className='relative min-w-[260px]'>
                    <LuSearch className={`absolute ${isAr ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 size-4 text-gray-400`} />
                    <input
                        type='text'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className={`w-full py-2.5 ${isAr ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'} bg-gray-50 border border-gray-200 focus:border-[#1E7D67] focus:bg-white rounded-xl text-xs md:text-sm outline-none transition-colors`}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}
                        >
                            <LuX className='size-3.5' />
                        </button>
                    )}
                </div>

            </div>

            {/* ── 3. Video Cards Grid ── */}
            {filteredVideos.length === 0 ? (
                <div className='py-20 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200 my-6'>
                    <LuFilm className='size-12 mx-auto text-gray-300 mb-3' />
                    <h3 className='text-base font-bold text-gray-700'>{t('noVideos')}</h3>
                    <p className='text-xs text-gray-400 mt-1 max-w-sm mx-auto'>
                        {searchQuery ? 'جرّب البحث بكلمات أخرى أو اختر تصنيفاً آخر.' : 'سيتم إضافة المزيد من العروض والفيديوهات قريباً.'}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
                            className='mt-4 text-xs font-semibold text-[#1E7D67] hover:underline'
                        >
                            إعادة ضبط البحث
                        </button>
                    )}
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7'>
                    {filteredVideos.map((video) => {
                        const parsed = parseVideoUrl(video.videoUrl)
                        const thumb = video.thumbnailUrl || parsed.thumbnailUrl || '/assets/default_thumb.jpg'
                        const categoryObj = VIDEO_CATEGORIES.find((c) => c.key === video.category)

                        return (
                            <article
                                key={video.id}
                                className='group bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col'
                            >
                                {/* Thumbnail Image + Hover Play Button */}
                                <div
                                    onClick={() => setActiveVideo(video)}
                                    className='relative aspect-video bg-black overflow-hidden cursor-pointer'
                                >
                                    <img
                                        src={thumb}
                                        alt={video.title}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                                    />

                                    {/* Hover Dark Vignette */}
                                    <div className='absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors' />

                                    {/* Center Play Button Overlay */}
                                    <div className='absolute inset-0 flex items-center justify-center'>
                                        <div className='size-12 rounded-full bg-white/90 group-hover:bg-[#00FFB2] text-gray-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-all'>
                                            <LuPlay className='size-5 fill-current translate-x-0.5' />
                                        </div>
                                    </div>

                                    {/* Category Pill (Top Left) */}
                                    <div className='absolute top-3 left-3'>
                                        <span className='px-2.5 py-1 rounded-md text-[11px] font-bold bg-black/75 backdrop-blur-sm text-white'>
                                            {categoryObj ? (isAr ? categoryObj.labelAr : categoryObj.labelEn) : video.category}
                                        </span>
                                    </div>

                                    {/* Duration Pill (Bottom Right) */}
                                    {video.duration && (
                                        <div className='absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-white text-[11px] font-mono flex items-center gap-1'>
                                            <LuClock className='size-3 text-[#00FFB2]' />
                                            <span>{video.duration}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content Info */}
                                <div className='p-5 flex-1 flex flex-col justify-between'>
                                    <div>
                                        <h3
                                            onClick={() => setActiveVideo(video)}
                                            className='font-bold text-gray-900 text-base leading-snug hover:text-[#1E7D67] transition-colors cursor-pointer line-clamp-2'
                                        >
                                            {getLocalizedTitle(video)}
                                        </h3>

                                        {getLocalizedDesc(video) && (
                                            <p className='text-xs sm:text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed'>
                                                {getLocalizedDesc(video)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action row */}
                                    <div className='pt-4 mt-4 border-t border-gray-100 flex items-center justify-between'>
                                        <button
                                            onClick={() => setActiveVideo(video)}
                                            className='inline-flex items-center gap-1.5 text-xs font-bold text-[#1E7D67] group-hover:text-[#00FFB2] group-hover:bg-[#1E7D67] px-3 py-1.5 rounded-lg transition-colors'
                                        >
                                            <LuPlay className='size-3.5 fill-current' />
                                            <span>{t('watch')}</span>
                                        </button>

                                        <button
                                            onClick={() => copyShareLink(video)}
                                            className='p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors'
                                            title='Share Video'
                                            aria-label='Share Video'
                                        >
                                            {copied ? <LuCheck className='size-4 text-emerald-600' /> : <LuShare2 className='size-4' />}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            {/* ── 4. Interactive Cinema Theater Modal / Lightbox ── */}
            {activeVideo && (
                <div
                    className='fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200'
                    onClick={() => setActiveVideo(null)}
                >
                    <div
                        className='bg-[#0F1922] border border-white/10 rounded-2xl sm:rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[95svh]'
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className='px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40'>
                            <div className='flex items-center gap-2'>
                                <span className='size-2.5 rounded-full bg-[#00FFCD] animate-pulse' />
                                <h4 className='text-white font-bold text-sm sm:text-base truncate max-w-[70vw]'>
                                    {getLocalizedTitle(activeVideo)}
                                </h4>
                            </div>
                            <button
                                onClick={() => setActiveVideo(null)}
                                className='p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors'
                                aria-label='Close video'
                            >
                                <LuX className='size-5' />
                            </button>
                        </div>

                        {/* Video Player */}
                        <div className='relative w-full aspect-video bg-black'>
                            {(() => {
                                const parsed = parseVideoUrl(activeVideo.videoUrl)
                                if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
                                    return (
                                        <iframe
                                            src={parsed.embedUrl}
                                            title={activeVideo.title}
                                            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                            allowFullScreen
                                            className='w-full h-full border-0'
                                        />
                                    )
                                }
                                return (
                                    <video
                                        src={activeVideo.videoUrl}
                                        controls
                                        autoPlay
                                        playsInline
                                        className='w-full h-full object-contain'
                                    />
                                )
                            })()}
                        </div>

                        {/* Video Details & CTA below player */}
                        <div className='p-5 sm:p-6 bg-[#0B141B] space-y-4 overflow-y-auto'>
                            <div className='flex flex-col sm:flex-row justify-between sm:items-center gap-4'>
                                <div>
                                    <h3 className='text-lg sm:text-xl font-bold text-white'>
                                        {getLocalizedTitle(activeVideo)}
                                    </h3>
                                    {getLocalizedDesc(activeVideo) && (
                                        <p className='text-white/70 text-xs sm:text-sm mt-1 leading-relaxed max-w-3xl'>
                                            {getLocalizedDesc(activeVideo)}
                                        </p>
                                    )}
                                </div>

                                <div className='flex items-center gap-3 flex-shrink-0'>
                                    <LocaleLink
                                        href='/contact'
                                        onClick={() => setActiveVideo(null)}
                                        className='inline-flex items-center gap-2 bg-[#00FFB2] hover:bg-[#00e6a1] text-gray-950 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-md transition-colors'
                                    >
                                        <span>{t('startProject')}</span>
                                        {isAr ? <LuArrowLeft className='size-4' /> : <LuArrowRight className='size-4' />}
                                    </LocaleLink>
                                    <button
                                        onClick={() => copyShareLink(activeVideo)}
                                        className='p-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors text-xs flex items-center gap-1.5'
                                        title='Share'
                                    >
                                        {copied ? <LuCheck className='size-4 text-[#00FFB2]' /> : <LuShare2 className='size-4' />}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </section>
    )
}
