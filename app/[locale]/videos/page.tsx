import React from 'react'
import prisma from '@/prisma/client'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import VideosHeader from './components/VideosHeader'
import VideosShowcase, { type VideoData } from './components/VideosShowcase'
import VideoSchema from './components/VideoSchema'
import Footer from '../components/Footer'
import ScrollReveal from '../components/ScrollReveal'

export const revalidate = 60 // regenerate every minute

async function getVideos(): Promise<VideoData[]> {
    try {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('DB timeout')), 5000)
        )
        const fetchPromise = prisma.video.findMany({
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                title: true,
                titleEn: true,
                description: true,
                descriptionEn: true,
                videoUrl: true,
                thumbnailUrl: true,
                duration: true,
                durationSec: true,
                category: true,
                order: true,
                isFeatured: true,
                createdAt: true,
            },
        })

        const videos = await Promise.race([fetchPromise, timeout])
        return JSON.parse(JSON.stringify(videos))
    } catch (e: any) {
        console.error('[VideosPage] Error fetching videos:', e.message)
        return []
    }
}

export default async function VideosPage({ params }: { params: { locale: string } }) {
    const locale = params?.locale || 'ar'
    const isAr = locale === 'ar'
    const videos = await getVideos()

    return (
        <div className='min-h-screen flex flex-col bg-white'>
            {/* SEO Breadcrumbs */}
            <BreadcrumbsJsonLd
                items={[{ path: 'videos', ar: 'الفيديوهات', en: 'Videos' }]}
            />

            {/* VideoObject Structured Data */}
            <VideoSchema
                videos={videos.map((v) => ({
                    id: v.id,
                    title: isAr ? v.title : (v.titleEn || v.title),
                    description: isAr ? v.description : (v.descriptionEn || v.description),
                    thumbnailUrl: v.thumbnailUrl,
                    videoUrl: v.videoUrl,
                    createdAt: v.createdAt,
                }))}
                locale={locale}
            />

            {/* Hero Header */}
            <VideosHeader />

            {/* Main Showcase Section */}
            <main className='flex-1'>
                <ScrollReveal>
                    <VideosShowcase initialVideos={videos} />
                </ScrollReveal>
            </main>

            {/* Footer */}
            <Footer />
        </div>
    )
}
