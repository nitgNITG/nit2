/* eslint-disable @next/next/no-img-element */
'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import axios from 'axios'
import { LuUpload, LuLink, LuVideo, LuImage, LuCheck, LuX, LuSparkles, LuPlay } from 'react-icons/lu'
import { CloseIcon, LoadingIcon } from '../../components/icons'
import useClickOutside from '../../hook/useClickOutSide'
import { useStore } from '@/lib/zustand'
import { parseVideoUrl, VIDEO_CATEGORIES } from '@/lib/videos'
import { uploadPromoFile } from './promoUpload'

interface AddEditVideoProps {
    close: () => void
    onSuccess?: () => void
}

export default function AddEditVideo({ close, onSuccess }: AddEditVideoProps) {
    const { editVideo, setEditVideo, addVideo, updateVideo }: any = useStore()
    const [videoMode, setVideoMode] = useState<'url' | 'upload'>('url')
    const [videoUrl, setVideoUrl] = useState(editVideo?.videoUrl || '')
    const [publicId, setPublicId] = useState<string | null>(editVideo?.publicId || null)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [thumbnailUrl, setThumbnailUrl] = useState(editVideo?.thumbnailUrl || '')
    const [thumbFile, setThumbFile] = useState<File | null>(null)
    const [thumbPreview, setThumbPreview] = useState<string>(editVideo?.thumbnailUrl || '')
    const [loading, setLoading] = useState(false)
    const eleRef = useClickOutside(close)
    const thumbInputRef = useRef<HTMLInputElement>(null)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            title: editVideo?.title || '',
            titleEn: editVideo?.titleEn || '',
            description: editVideo?.description || '',
            descriptionEn: editVideo?.descriptionEn || '',
            category: editVideo?.category || 'showcase',
            duration: editVideo?.duration || '',
            order: editVideo?.order ?? 0,
            isFeatured: !!editVideo?.isFeatured,
        },
    })

    // Parsed video url info
    const parsed = parseVideoUrl(videoUrl)

    // Auto-update thumbnail preview from YouTube / Cloudinary if no manual thumbnail was chosen
    useEffect(() => {
        if (!thumbFile && parsed.thumbnailUrl && (!thumbnailUrl || thumbnailUrl.includes('youtube.com') || thumbnailUrl.includes('cloudinary.com'))) {
            setThumbnailUrl(parsed.thumbnailUrl)
            setThumbPreview(parsed.thumbnailUrl)
        }
    }, [videoUrl, parsed.thumbnailUrl, thumbFile, thumbnailUrl])

    // Direct Cloudinary Upload for video file
    const handleVideoFileUpload = async (file?: File) => {
        if (!file) return
        if (!file.type.startsWith('video/')) {
            toast.error('Please choose a valid video file (MP4, WebM, MOV)')
            return
        }

        try {
            setUploadProgress(0)
            const up = await uploadPromoFile(file, 'video', (fraction) => {
                setUploadProgress(fraction)
            })
            setVideoUrl(up.secure_url)
            setPublicId(up.public_id)
            if (up.duration) {
                const mins = Math.floor(up.duration / 60)
                const secs = Math.round(up.duration % 60)
                setValue('duration', `${mins}:${secs < 10 ? '0' : ''}${secs}`)
            }
            toast.success('Video uploaded successfully!')
        } catch (err: any) {
            console.error(err)
            toast.error(err?.message || 'Video upload failed. Cloudinary may not be configured; you can paste a video URL instead.')
        } finally {
            setUploadProgress(null)
        }
    }

    // Thumbnail file selection
    const handleThumbFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setThumbFile(file)
        setThumbPreview(URL.createObjectURL(file))
    }

    const onSubmit = async (formData: any) => {
        if (!videoUrl.trim()) {
            toast.error('Please upload a video or enter a video URL')
            return
        }

        try {
            setLoading(true)
            const postForm = new FormData()
            postForm.append('title', formData.title)
            postForm.append('titleEn', formData.titleEn || '')
            postForm.append('description', formData.description || '')
            postForm.append('descriptionEn', formData.descriptionEn || '')
            postForm.append('videoUrl', videoUrl.trim())
            postForm.append('thumbnailUrl', thumbnailPreviewOrUrl())
            postForm.append('category', formData.category)
            postForm.append('duration', formData.duration || '')
            postForm.append('order', String(formData.order ?? 0))
            postForm.append('isFeatured', String(!!formData.isFeatured))
            if (publicId) postForm.append('publicId', publicId)
            if (thumbFile) postForm.append('thumbnailFile', thumbFile)

            if (editVideo) {
                const { data } = await axios.put(`/api/videos/${editVideo.id}`, postForm)
                toast.success(data.message || 'Video updated successfully')
                updateVideo(data.video)
            } else {
                const { data } = await axios.post('/api/videos', postForm)
                toast.success(data.message || 'Video added successfully')
                addVideo(data.video)
            }

            setEditVideo(null)
            if (onSuccess) onSuccess()
            close()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || error.message || 'Failed to save video')
        } finally {
            setLoading(false)
        }
    }

    const thumbnailPreviewOrUrl = () => {
        if (thumbFile) return '' // API handles upload from thumbnailFile
        return thumbnailUrl || parsed.thumbnailUrl || ''
    }

    return (
        <div className='w-full h-full fixed bg-black/50 backdrop-blur-sm top-0 left-0 flex justify-center items-center px-4 z-50 overflow-y-auto py-10'>
            <div ref={eleRef} className='bg-white w-full sm:w-[500px] md:w-[620px] lg:w-[720px] rounded-2xl max-h-[92svh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden'>
                
                {/* Header */}
                <div className='pt-5 px-6 pb-4 border-b flex justify-between items-center bg-gray-50/60'>
                    <div className='flex items-center gap-2.5'>
                        <div className='p-2 bg-emerald-100 text-emerald-800 rounded-lg'>
                            <LuVideo className='size-5' />
                        </div>
                        <div>
                            <h5 className='font-bold text-gray-900 text-lg'>
                                {editVideo ? 'Edit Video' : 'Add New Video'}
                            </h5>
                            <p className='text-xs text-gray-500'>
                                {editVideo ? 'تعديل بيانات الفيديو' : 'إضافة فيديو جديد لمعرض الفيديوهات'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={close}
                        className='p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors'
                        aria-label='Close'
                    >
                        <LuX className='size-5' />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit(onSubmit)} className='flex-1 overflow-y-auto px-6 py-5 space-y-5'>

                    {/* ── 1. Video Source Section ── */}
                    <div className='border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3'>
                        <div className='flex items-center justify-between'>
                            <label className='text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5'>
                                <LuVideo className='size-4 text-emerald-600' />
                                Video Source <span className='text-red-500'>*</span>
                            </label>
                            
                            {/* Mode Toggle */}
                            <div className='inline-flex bg-gray-200 p-0.5 rounded-lg text-xs font-medium'>
                                <button
                                    type='button'
                                    onClick={() => setVideoMode('url')}
                                    className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${videoMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <LuLink className='size-3.5' /> Link (YouTube / URL)
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setVideoMode('upload')}
                                    className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${videoMode === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <LuUpload className='size-3.5' /> Direct Upload
                                </button>
                            </div>
                        </div>

                        {videoMode === 'url' ? (
                            <div className='space-y-2'>
                                <input
                                    type='url'
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder='e.g. https://www.youtube.com/watch?v=... or direct MP4 URL'
                                    className='w-full px-3.5 py-2.5 bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none text-sm'
                                />
                                {videoUrl && (
                                    <div className='flex items-center gap-2 text-xs'>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${parsed.type === 'youtube' ? 'bg-red-50 text-red-600' : parsed.type === 'vimeo' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                            <LuCheck className='size-3' /> Detected {parsed.type.toUpperCase()}
                                        </span>
                                        {parsed.videoId && <span className='text-gray-400'>ID: {parsed.videoId}</span>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                {uploadProgress != null ? (
                                    <div className='p-4 bg-white border border-gray-200 rounded-xl space-y-2'>
                                        <div className='flex justify-between text-xs text-gray-600 font-medium'>
                                            <span>Uploading video to Cloudinary…</span>
                                            <span>{Math.round(uploadProgress * 100)}%</span>
                                        </div>
                                        <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
                                            <div
                                                className='h-full bg-emerald-500 transition-all duration-300'
                                                style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <label className='flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-xl p-5 cursor-pointer transition-colors text-center'>
                                        <LuUpload className='size-8 text-gray-400 mb-1' />
                                        <span className='text-sm font-medium text-gray-700'>Click or drag video file here (MP4, WebM)</span>
                                        <span className='text-xs text-gray-400 mt-0.5'>Large videos upload automatically in chunks</span>
                                        <input
                                            type='file'
                                            accept='video/*'
                                            className='hidden'
                                            onChange={(e) => handleVideoFileUpload(e.target.files?.[0])}
                                        />
                                    </label>
                                )}
                                {videoUrl && (
                                    <div className='text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg flex items-center justify-between'>
                                        <span className='truncate max-w-[85%] font-mono'>{videoUrl}</span>
                                        <button
                                            type='button'
                                            onClick={() => { setVideoUrl(''); setPublicId(null) }}
                                            className='text-red-500 hover:underline'
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── 2. Thumbnail / Poster Section ── */}
                    <div className='border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3'>
                        <div className='flex items-center justify-between'>
                            <label className='text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5'>
                                <LuImage className='size-4 text-emerald-600' />
                                Thumbnail / Poster Image
                            </label>
                            <button
                                type='button'
                                onClick={() => thumbInputRef.current?.click()}
                                className='text-xs text-emerald-700 hover:underline font-medium'
                            >
                                Upload Custom Image
                            </button>
                            <input
                                ref={thumbInputRef}
                                type='file'
                                accept='image/*'
                                className='hidden'
                                onChange={handleThumbFileChange}
                            />
                        </div>

                        <div className='flex items-center gap-4'>
                            {thumbPreview ? (
                                <div className='relative w-44 aspect-video bg-black rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 group'>
                                    <img src={thumbPreview} alt='Preview' className='w-full h-full object-cover' />
                                    <button
                                        type='button'
                                        onClick={() => thumbInputRef.current?.click()}
                                        className='absolute inset-0 bg-black/40 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity font-medium'
                                    >
                                        Change Image
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => thumbInputRef.current?.click()}
                                    className='w-44 aspect-video border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-emerald-400 cursor-pointer flex-shrink-0'
                                >
                                    <LuImage className='size-5 mb-1' />
                                    <span className='text-[11px]'>No Thumbnail</span>
                                </div>
                            )}

                            <div className='flex-1 space-y-1.5 text-xs text-gray-500'>
                                <p>• If using YouTube, the thumbnail is extracted automatically.</p>
                                <p>• You can upload a high-resolution custom thumbnail (WebP/PNG/JPG).</p>
                                <input
                                    type='text'
                                    placeholder='Or paste image URL directly'
                                    value={thumbnailUrl}
                                    onChange={(e) => {
                                        setThumbnailUrl(e.target.value)
                                        setThumbPreview(e.target.value)
                                        setThumbFile(null)
                                    }}
                                    className='w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-xs outline-none focus:border-emerald-500'
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 3. Title & Description: Arabic (Primary) ── */}
                    <div className='border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3' dir='rtl'>
                        <div className='flex items-center justify-between'>
                            <label className='text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5'>
                                بيانات الفيديو بالعربية (أساسي) <span className='text-red-500'>*</span>
                            </label>
                            <span className='text-[11px] text-gray-400'>AR</span>
                        </div>
                        <div>
                            <input
                                {...register('title', { required: 'العنوان بالعربية مطلوب' })}
                                placeholder='عنوان الفيديو بالعربية (مثال: استعراض منصة لغات للتعليم التفاعلي)'
                                className='w-full px-3.5 py-2.5 bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none text-sm text-right'
                            />
                            {errors.title && (
                                <p className='text-red-500 text-xs mt-1'>{errors.title.message as string}</p>
                            )}
                        </div>
                        <div>
                            <textarea
                                {...register('description')}
                                placeholder='وصف مختصر لمحتوى الفيديو والنتائج المحققة...'
                                rows={2}
                                className='w-full px-3.5 py-2 bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none text-sm text-right resize-none'
                            />
                        </div>
                    </div>

                    {/* ── 4. Title & Description: English (Optional) ── */}
                    <div className='border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3'>
                        <div className='flex items-center justify-between'>
                            <label className='text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5'>
                                English Info (Optional)
                            </label>
                            <span className='text-[11px] text-gray-400'>EN</span>
                        </div>
                        <input
                            {...register('titleEn')}
                            placeholder='Title in English (e.g. Loghat Platform Interactive Demo)'
                            className='w-full px-3.5 py-2.5 bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none text-sm'
                        />
                        <textarea
                            {...register('descriptionEn')}
                            placeholder='Short description of the video content in English...'
                            rows={2}
                            className='w-full px-3.5 py-2 bg-white border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none text-sm resize-none'
                        />
                    </div>

                    {/* ── 5. Category, Duration, Order & Featured ── */}
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                        {/* Category */}
                        <div>
                            <label className='block text-xs font-medium text-gray-600 mb-1'>Category / التصنيف</label>
                            <select
                                {...register('category')}
                                className='w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-emerald-500'
                            >
                                {VIDEO_CATEGORIES.map((c) => (
                                    <option key={c.key} value={c.key}>
                                        {c.labelEn} — {c.labelAr}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className='block text-xs font-medium text-gray-600 mb-1'>Duration (e.g. 02:45)</label>
                            <input
                                {...register('duration')}
                                placeholder='01:30'
                                className='w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-emerald-500'
                            />
                        </div>

                        {/* Order */}
                        <div>
                            <label className='block text-xs font-medium text-gray-600 mb-1'>Display Order / الترتيب</label>
                            <input
                                type='number'
                                {...register('order', { valueAsNumber: true })}
                                placeholder='0'
                                className='w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-emerald-500'
                            />
                        </div>
                    </div>

                    {/* Featured Video Switch */}
                    <div className='p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                            <LuSparkles className='size-5 text-emerald-600' />
                            <div>
                                <span className='text-sm font-semibold text-gray-900 block'>
                                    Featured Video / فيديو مميز في الواجهة
                                </span>
                                <span className='text-xs text-gray-500 block'>
                                    يتم إبرازه في أعلى صفحة الفيديوهات في Spotlight
                                </span>
                            </div>
                        </div>
                        <input
                            type='checkbox'
                            {...register('isFeatured')}
                            className='accent-emerald-600 w-5 h-5 rounded cursor-pointer'
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className='pt-2 flex items-center justify-end gap-3 border-t'>
                        <button
                            type='button'
                            onClick={close}
                            className='px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors'
                        >
                            Cancel / إلغاء
                        </button>
                        <button
                            type='submit'
                            disabled={loading}
                            className='px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50'
                        >
                            {loading ? (
                                <>
                                    <LoadingIcon className='size-4 animate-spin' />
                                    <span>Saving…</span>
                                </>
                            ) : (
                                <span>{editVideo ? 'Update Video' : 'Save & Publish Video'}</span>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    )
}
