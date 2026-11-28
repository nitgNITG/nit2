import React from 'react'
import VideoManager from '../components/VideoManager'

export const metadata = {
    title: 'Videos | Dashboard | N.I.T Egypt',
    description: 'Manage website videos and media showcase.',
}

export default function DashboardVideosPage() {
    return (
        <div className='dashboard-container py-6 lg:py-10 space-y-8'>
            <VideoManager />
        </div>
    )
}
