/* eslint-disable @next/next/no-img-element */
'use client'
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
    LuVideo, LuPlus, LuSearch, LuPlay, LuPencil, LuTrash2, LuSparkles,
    LuExternalLink, LuClock, LuEye, LuLayers, LuFilm, LuX
} from 'react-icons/lu'
import { useStore } from '@/lib/zustand'
import { parseVideoUrl, DEFAULT_VIDEO_CATEGORIES, type CategoryItem } from '@/lib/videos'
import AddEditVideo from './AddEditVideo'
import DailogDelete from './DailogDelete'
import ManageCategoriesModal from './ManageCategoriesModal'

export interface VideoItem {
    id: string
    title: string
    titleEn?: string | null
    description?: string | null
    descriptionEn?: string | null
    videoUrl: string
    thumbnailUrl?: string | null
    duration?: string | null
    category?: string | null
    categoryAr?: string | null
    categoryEn?: string | null
    publicId?: string | null
    order: number
    isFeatured: boolean
    views?: number
    createdAt: string
}

export default function VideoManager() {
    const { videos, setVideos, setEditVideo, deleteVideo, updateVideo }: any = useStore()
    const [loading, setLoading] = useState(true)
    const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_VIDEO_CATEGORIES)
    const [showCategoriesModal, setShowCategoriesModal] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null)

    const fetchVideos = async () => {
        try {
            setLoading(true)
            const { data } = await axios.get('/api/videos')
            if (data?.videos) {
                setVideos(data.videos)
            }
        } catch (error: any) {
            console.error('Failed to load videos:', error)
            toast.error('Could not load videos')
        } finally {
            setLoading(false)
        }
    }

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/video-categories')
            if (data?.categories?.length) {
                setCategories(data.categories)
            }
        } catch (error: any) {
            console.error('Failed to load categories:', error)
        }
    }

    useEffect(() => {
        fetchVideos()
        fetchCategories()
    }, [])

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            setDeleteLoading(true)
            const { data } = await axios.delete(`/api/videos/${deleteId}`)
            deleteVideo(deleteId)
            toast.success(data?.message || 'Video deleted')
            setDeleteId(null)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to delete video')
        } finally {
            setDeleteLoading(false)
        }
    }

    const toggleFeatured = async (video: VideoItem) => {
        try {
            const nextStatus = !video.isFeatured
            const { data } = await axios.put(`/api/videos/${video.id}`, { isFeatured: nextStatus })
            updateVideo(data.video)
            toast.success(nextStatus ? 'Marked as Featured' : 'Unmarked from Featured')
        } catch (err: any) {
            toast.error('Failed to update status')
        }
    }

    // Filtered videos
    const filteredVideos: VideoItem[] = (videos || []).filter((v: VideoItem) => {
        const matchesCategory = categoryFilter === 'all' || v.category === categoryFilter
        const q = searchQuery.toLowerCase().trim()
        const matchesSearch = !q ||
            v.title.toLowerCase().includes(q) ||
            (v.titleEn && v.titleEn.toLowerCase().includes(q)) ||
            (v.description && v.description.toLowerCase().includes(q))
        return matchesCategory && matchesSearch
    })

    const featuredCount = (videos || []).filter((v: VideoItem) => v.isFeatured).length

    return (
        <div className='space-y-6'>
            {/* Top Toolbar */}
            <div className='flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm'>
                <div className='flex items-center gap-3'>
                    <div className='p-2.5 bg-emerald-100 text-emerald-800 rounded-xl'>
                        <LuFilm className='size-6' />
                    </div>
                    <div>
                        <div className='flex items-center gap-2'>
                            <h3 className='font-bold text-xl text-gray-900'>Video Showcase</h3>
                            <span className='bg-emerald-100 text-emerald-800 font-semibold text-xs px-2.5 py-0.5 rounded-full'>
                                {videos?.length || 0} Total
                            </span>
                        </div>
                        <p className='text-xs text-gray-500'>
                            إدارة ورفع الفيديوهات المعروضة في صفحة الفيديوهات العامة (Videos)
                        </p>
                    </div>
                </div>

                <div className='flex items-center gap-2.5'>
                    <button
                        onClick={() => setShowCategoriesModal(true)}
                        className='inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors border border-gray-200'
                        title='إدارة تصنيفات الفيديوهات'
                    >
                        <LuLayers className='size-4 text-emerald-600' />
                        <span>Categories / إدارة التصنيفات</span>
                    </button>

                    <button
                        onClick={() => {
                            setEditVideo(null)
                            setShowForm(true)
                        }}
                        className='inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm'
                    >
                        <LuPlus className='size-4' />
                        Add Video / إضافة فيديو
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between'>
                    <div>
                        <p className='text-xs text-gray-500 font-medium'>Total Published</p>
                        <p className='text-2xl font-bold text-gray-900 mt-1'>{videos?.length || 0}</p>
                    </div>
                    <div className='p-2.5 bg-gray-100 text-gray-600 rounded-lg'>
                        <LuVideo className='size-5' />
                    </div>
                </div>

                <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between'>
                    <div>
                        <p className='text-xs text-gray-500 font-medium'>Featured in Spotlight</p>
                        <p className='text-2xl font-bold text-emerald-600 mt-1'>{featuredCount}</p>
                    </div>
                    <div className='p-2.5 bg-emerald-50 text-emerald-600 rounded-lg'>
                        <LuSparkles className='size-5' />
                    </div>
                </div>

                <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between'>
                    <div>
                        <p className='text-xs text-gray-500 font-medium'>Active Categories</p>
                        <p className='text-2xl font-bold text-blue-600 mt-1'>{categories.length}</p>
                    </div>
                    <div className='p-2.5 bg-blue-50 text-blue-600 rounded-lg'>
                        <LuLayers className='size-5' />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between'>
                {/* Search */}
                <div className='relative w-full md:w-80'>
                    <LuSearch className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400' />
                    <input
                        type='text'
                        placeholder='Search videos by title or description…'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className='w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    />
                </div>

                {/* Category Pills */}
                <div className='flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0'>
                    <button
                        onClick={() => setCategoryFilter('all')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${categoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        All / الكل
                    </button>
                    {categories.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => setCategoryFilter(c.value)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${categoryFilter === c.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {c.labelEn}
                        </button>
                    ))}
                </div>
            </div>

            {/* Video List */}
            {loading ? (
                <div className='bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400'>
                    <div className='inline-block animate-spin size-8 border-2 border-emerald-600 border-t-transparent rounded-full mb-2' />
                    <p className='text-sm'>Loading videos…</p>
                </div>
            ) : filteredVideos.length === 0 ? (
                <div className='bg-white rounded-xl border border-gray-200 p-12 text-center'>
                    <LuVideo className='size-12 mx-auto text-gray-300 mb-3' />
                    <h4 className='font-bold text-gray-800 text-base'>No videos found</h4>
                    <p className='text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-5'>
                        {searchQuery || categoryFilter !== 'all'
                            ? 'Try clearing the search or category filters.'
                            : 'Start by uploading or linking your first video to showcase projects and features.'}
                    </p>
                    <button
                        onClick={() => {
                            setEditVideo(null)
                            setShowForm(true)
                        }}
                        className='inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors'
                    >
                        <LuPlus className='size-3.5' /> Add First Video
                    </button>
                </div>
            ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                    {filteredVideos.map((video) => {
                        const parsed = parseVideoUrl(video.videoUrl)
                        const categoryObj = categories.find((c) => c.value === video.category)
                        const thumb = video.thumbnailUrl || parsed.thumbnailUrl || '/assets/default_thumb.jpg'

                        return (
                            <div
                                key={video.id}
                                className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-shadow'
                            >
                                {/* Thumbnail Area */}
                                <div className='relative aspect-video bg-black overflow-hidden'>
                                    <img
                                        src={thumb}
                                        alt={video.title}
                                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                                    />
                                    {/* Play Overlay */}
                                    <button
                                        onClick={() => setPreviewVideo(video)}
                                        className='absolute inset-0 bg-black/30 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity'
                                        aria-label='Preview Video'
                                    >
                                        <div className='size-12 rounded-full bg-white/90 text-gray-900 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all'>
                                            <LuPlay className='size-5 fill-current ml-0.5' />
                                        </div>
                                    </button>

                                    {/* Top badges */}
                                    <div className='absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none'>
                                        <span className='px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/60 backdrop-blur-sm text-white uppercase'>
                                            {categoryObj?.labelEn || video.category || 'Showcase'}
                                        </span>

                                        {video.isFeatured && (
                                            <span className='px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500 text-white flex items-center gap-1 shadow-sm'>
                                                <LuSparkles className='size-3' /> Featured
                                            </span>
                                        )}
                                    </div>

                                    {/* Duration Badge */}
                                    {video.duration && (
                                        <div className='absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white text-[11px] font-mono flex items-center gap-1'>
                                            <LuClock className='size-3' /> {video.duration}
                                        </div>
                                    )}

                                    {/* Source badge */}
                                    <div className='absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white text-[10px] font-mono'>
                                        {parsed.type.toUpperCase()}
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className='p-4 flex-1 flex flex-col justify-between'>
                                    <div>
                                        <h4 className='font-bold text-gray-900 text-base leading-snug line-clamp-1'>
                                            {video.title}
                                        </h4>
                                        {video.titleEn && (
                                            <p className='text-xs text-gray-500 font-medium line-clamp-1 mt-0.5'>
                                                {video.titleEn}
                                            </p>
                                        )}
                                        {video.description && (
                                            <p className='text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed'>
                                                {video.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Card Footer / Actions */}
                                    <div className='pt-4 mt-3 border-t border-gray-100 flex items-center justify-between text-xs'>
                                        <button
                                            onClick={() => toggleFeatured(video)}
                                            className={`font-medium flex items-center gap-1 transition-colors ${video.isFeatured ? 'text-emerald-600 hover:text-emerald-700' : 'text-gray-400 hover:text-gray-600'}`}
                                            title='Toggle Spotlight status'
                                        >
                                            <LuSparkles className='size-3.5' />
                                            {video.isFeatured ? 'Featured' : 'Make Featured'}
                                        </button>

                                        <div className='flex items-center gap-1'>
                                            <button
                                                onClick={() => {
                                                    setEditVideo(video)
                                                    setShowForm(true)
                                                }}
                                                className='p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'
                                                title='Edit Video'
                                            >
                                                <LuPencil className='size-4' />
                                            </button>
                                            <button
                                                onClick={() => setDeleteId(video.id)}
                                                className='p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                                                title='Delete Video'
                                            >
                                                <LuTrash2 className='size-4' />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add / Edit Video Modal */}
            {showForm && (
                <AddEditVideo
                    categories={categories}
                    onOpenCategories={() => setShowCategoriesModal(true)}
                    close={() => {
                        setShowForm(false)
                        setEditVideo(null)
                    }}
                    onSuccess={fetchVideos}
                />
            )}

            {/* Manage Categories Modal */}
            {showCategoriesModal && (
                <ManageCategoriesModal
                    categories={categories}
                    close={() => setShowCategoriesModal(false)}
                    onUpdated={() => {
                        fetchCategories()
                    }}
                />
            )}

            {/* Quick Preview Lightbox Modal */}
            {previewVideo && (
                <div
                    className='w-full h-full fixed bg-black/80 backdrop-blur-md top-0 left-0 flex justify-center items-center p-4 z-50'
                    onClick={() => setPreviewVideo(null)}
                >
                    <div
                        className='bg-black rounded-2xl overflow-hidden max-w-4xl w-full aspect-video relative shadow-2xl border border-white/10'
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const parsed = parseVideoUrl(previewVideo.videoUrl)
                            if (parsed.type === 'youtube' || parsed.type === 'vimeo') {
                                return (
                                    <iframe
                                        src={parsed.embedUrl}
                                        title={previewVideo.title}
                                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                        allowFullScreen
                                        className='w-full h-full border-0'
                                    />
                                )
                            }
                            return (
                                <video
                                    src={previewVideo.videoUrl}
                                    controls
                                    autoPlay
                                    playsInline
                                    className='w-full h-full object-contain'
                                />
                            )
                        })()}
                        <button
                            onClick={() => setPreviewVideo(null)}
                            className='absolute top-4 right-4 bg-black/60 hover:bg-black/90 text-white rounded-full p-2 transition-colors'
                            aria-label='Close preview'
                        >
                            <LuX className='size-5' />
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteId && (
                <DailogDelete
                    title='Delete Video / حذف الفيديو'
                    message='Are you sure you want to permanently delete this video? This action cannot be undone.'
                    close={() => setDeleteId(null)}
                    loading={deleteLoading}
                    handleDelete={handleDelete}
                />
            )}
        </div>
    )
}
