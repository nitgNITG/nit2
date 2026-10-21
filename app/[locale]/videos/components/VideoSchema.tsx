import React from 'react'

export interface VideoSchemaItem {
    id: string
    title: string
    description?: string | null
    thumbnailUrl?: string | null
    videoUrl: string
    createdAt: Date | string
}

export default function VideoSchema({ videos, locale }: { videos: VideoSchemaItem[]; locale: string }) {
    if (!videos || videos.length === 0) return null

    const schemaList = videos.map((video) => ({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: video.title,
        description: video.description || video.title,
        thumbnailUrl: [video.thumbnailUrl || 'https://www.nitg-eg.com/og-image.png'],
        uploadDate: new Date(video.createdAt).toISOString(),
        contentUrl: video.videoUrl,
        embedUrl: video.videoUrl,
    }))

    return (
        <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaList) }}
        />
    )
}
