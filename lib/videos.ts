export type VideoCategory = 'showcase' | 'promo' | 'tutorial' | 'review' | 'other'

export const VIDEO_CATEGORIES: { key: VideoCategory; labelAr: string; labelEn: string; icon?: string }[] = [
    { key: 'showcase', labelAr: 'استعراض المشاريع', labelEn: 'Project Showcase' },
    { key: 'promo', labelAr: 'فيديوهات ترويجية', labelEn: 'Promos & Reels' },
    { key: 'tutorial', labelAr: 'شروحات واستعراض أنظمة', labelEn: 'Tutorials & Systems' },
    { key: 'review', labelAr: 'آراء وتجارب العملاء', labelEn: 'Client Testimonials' },
    { key: 'other', labelAr: 'أخرى', labelEn: 'Other' },
]

export type VideoSourceType = 'youtube' | 'vimeo' | 'direct'

export interface ParsedVideoUrl {
    type: VideoSourceType
    embedUrl: string
    videoId?: string
    thumbnailUrl?: string
}

/**
 * Parse any video link (YouTube, Vimeo, Cloudinary, Direct MP4) into embed/playback format
 * and auto-generate high-quality thumbnail when available.
 */
export function parseVideoUrl(url: string): ParsedVideoUrl {
    const trimmed = (url || '').trim()

    // 1. YouTube
    // formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
    const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/)
    if (ytMatch && ytMatch[1]) {
        const id = ytMatch[1]
        return {
            type: 'youtube',
            videoId: id,
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
            thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        }
    }

    // 2. Vimeo
    // formats: vimeo.com/ID
    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/)
    if (vimeoMatch && vimeoMatch[3]) {
        const id = vimeoMatch[3]
        return {
            type: 'vimeo',
            videoId: id,
            embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0`,
            thumbnailUrl: undefined,
        }
    }

    // 3. Cloudinary or Direct MP4/WebM
    let derivedThumb: string | undefined
    if (trimmed.includes('cloudinary.com') && (trimmed.endsWith('.mp4') || trimmed.endsWith('.webm') || trimmed.includes('/video/upload/'))) {
        // Cloudinary video thumbnail transform: replace video extension with .jpg and add so_1 (frame at 1s)
        derivedThumb = trimmed
            .replace(/\/video\/upload\/(?:v\d+\/)?/, '/video/upload/so_1,w_800,c_fill,q_auto,f_jpg/')
            .replace(/\.(mp4|webm|mov|mkv)$/i, '.jpg')
    }

    return {
        type: 'direct',
        embedUrl: trimmed,
        thumbnailUrl: derivedThumb,
    }
}
