/* eslint-disable @next/next/no-img-element */
'use client'
import { useState } from 'react'
import { useFieldArray, type Control, type UseFormRegister } from 'react-hook-form'
import toast from 'react-hot-toast'
import { PROMO_SERVICES, promoUrls, TEASER_SECONDS, type StoredPromo } from '@/lib/promo'
import { CloseIcon } from '../../components/icons'
import { uploadPromoFile } from './promoUpload'

/**
 * Dashboard fields for the promo video + "Built by N.I.T" showcase
 * (docs/promo-videos-dev-spec.md). The video goes straight to Cloudinary; the
 * teaser loop and poster are cut from it by URL, previewed live below.
 */
export function PromoVideoField({ value, onChange }: { value: StoredPromo | null; onChange: (v: StoredPromo | null) => void }) {
    const [progress, setProgress] = useState<number | null>(null)
    const [captionBusy, setCaptionBusy] = useState<'captionsEn' | 'captionsAr' | null>(null)
    const urls = value ? promoUrls(value) : null

    const pickVideo = async (file?: File) => {
        if (!file) return
        if (!file.type.startsWith('video/')) { toast.error('Choose a video file (MP4)'); return }
        try {
            setProgress(0)
            const up = await uploadPromoFile(file, 'video', setProgress)
            onChange({
                videoUrl: up.secure_url,
                publicId: up.public_id,
                durationSec: up.duration ?? null,
                teaserStart: 0,
                posterAt: null,
                uploadDate: up.created_at ?? new Date().toISOString(),
                captionsEn: value?.captionsEn ?? null,
                captionsAr: value?.captionsAr ?? null,
            })
            toast.success('Video uploaded — save the project to publish it')
        } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Upload failed')
        } finally {
            setProgress(null)
        }
    }

    const pickCaptions = async (key: 'captionsEn' | 'captionsAr', file?: File) => {
        if (!file || !value) return
        if (!/\.vtt$/i.test(file.name)) { toast.error('Captions must be a .vtt file'); return }
        try {
            setCaptionBusy(key)
            const up = await uploadPromoFile(file, 'raw', () => {})
            onChange({ ...value, [key]: up.secure_url })
        } catch (e: any) {
            toast.error(e?.message || 'Upload failed')
        } finally {
            setCaptionBusy(null)
        }
    }

    const setNum = (key: 'teaserStart' | 'posterAt', raw: string) => {
        if (!value) return
        const n = raw === '' ? null : Math.max(0, Number(raw))
        onChange({ ...value, [key]: key === 'teaserStart' ? (n ?? 0) : n })
    }

    return (
        <div className='space-y-3'>
            {!value ? (
                <label className={`w-full h-28 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md flex flex-col justify-center items-center gap-1 text-gray-500 text-sm ${progress == null ? 'cursor-pointer hover:border-blue-400 hover:text-blue-500' : ''}`}>
                    {progress == null ? (
                        <>
                            <span className='font-medium'>Upload promo video (MP4, 30–60 s, with sound)</span>
                            <span className='text-xs text-gray-400'>Uploaded to Cloudinary. The 8 s muted teaser and the poster are made from it automatically.</span>
                        </>
                    ) : (
                        <span className='w-2/3'>
                            <span className='block text-center mb-1'>Uploading… {Math.round(progress * 100)}%</span>
                            <span className='block h-2 rounded bg-gray-200 overflow-hidden'><span className='block h-full bg-blue-500' style={{ width: `${progress * 100}%` }} /></span>
                        </span>
                    )}
                    <input type='file' accept='video/*' className='hidden' disabled={progress != null} onChange={(e) => pickVideo(e.target.files?.[0])} />
                </label>
            ) : (
                <div className='border rounded-lg p-3 space-y-3 bg-gray-50'>
                    <div className='flex justify-between items-center'>
                        <p className='text-xs font-semibold text-gray-500'>
                            Promo video{value.durationSec ? ` · ${Math.round(value.durationSec)} s` : ''}
                        </p>
                        <button type='button' onClick={() => onChange(null)} className='text-xs text-red-500 hover:underline flex items-center gap-1'>
                            <CloseIcon className='size-3.5' /> Remove promo
                        </button>
                    </div>
                    {urls ? (
                        <div className='grid grid-cols-2 gap-2'>
                            <figure className='m-0'>
                                <img src={urls.poster} alt='Poster frame' className='w-full aspect-video object-contain bg-black rounded' />
                                <figcaption className='text-[11px] text-gray-400 mt-1'>Poster</figcaption>
                            </figure>
                            <figure className='m-0'>
                                <video src={urls.teaserMp4} muted loop autoPlay playsInline className='w-full aspect-video object-contain bg-black rounded' />
                                <figcaption className='text-[11px] text-gray-400 mt-1'>Teaser ({TEASER_SECONDS} s muted loop)</figcaption>
                            </figure>
                        </div>
                    ) : <p className='text-xs text-red-500'>This video URL is not a Cloudinary video.</p>}
                    <div className='grid grid-cols-2 gap-2'>
                        <label className='text-xs text-gray-500'>Teaser starts at (s)
                            <input type='number' min={0} step={0.5} value={value.teaserStart ?? 0} onChange={(e) => setNum('teaserStart', e.target.value)}
                                className='mt-1 w-full border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm' />
                        </label>
                        <label className='text-xs text-gray-500'>Poster frame at (s)
                            <input type='number' min={0} step={0.5} value={value.posterAt ?? ''} placeholder='auto' onChange={(e) => setNum('posterAt', e.target.value)}
                                className='mt-1 w-full border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm' />
                        </label>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                        {(['captionsEn', 'captionsAr'] as const).map((key) => (
                            <div key={key} className='text-xs text-gray-500'>
                                <span>{key === 'captionsEn' ? 'English captions (.vtt)' : 'Arabic captions (.vtt)'}</span>
                                {value[key] ? (
                                    <div className='mt-1 flex items-center justify-between border rounded-md bg-white px-2 py-1.5'>
                                        <span className='text-green-600'>Uploaded</span>
                                        <button type='button' className='text-red-500 hover:underline' onClick={() => onChange({ ...value, [key]: null })}>Remove</button>
                                    </div>
                                ) : (
                                    <label className='mt-1 block border-2 border-dashed rounded-md px-2 py-1.5 text-center cursor-pointer hover:border-blue-400'>
                                        {captionBusy === key ? 'Uploading…' : 'Optional — only if not burned in'}
                                        <input type='file' accept='.vtt,text/vtt' className='hidden' onChange={(e) => pickCaptions(key, e.target.files?.[0])} />
                                    </label>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function ShowcaseExtraFields({ register, control }: { register: UseFormRegister<any>; control: Control<any> }) {
    const results = useFieldArray({ control, name: 'keyResults' })
    const input = 'w-full border-2 focus:border-blue-500 rounded-md outline-none py-1.5 px-2 text-sm'
    return (
        <div className='space-y-4'>
            <div>
                <label className='block text-xs text-gray-400 mb-2 uppercase tracking-wide'>Show on service pages (&quot;Built by N.I.T&quot;)</label>
                <div className='grid grid-cols-2 gap-1.5'>
                    {PROMO_SERVICES.map((s) => (
                        <label key={s.slug} className='flex items-center gap-2 text-sm text-gray-700'>
                            <input type='checkbox' value={s.slug} {...register('services')} className='accent-blue-500 w-4 h-4' />
                            {s.labelEn}
                        </label>
                    ))}
                </div>
            </div>

            <label className='block text-xs text-gray-400 uppercase tracking-wide'>Featured on Our Projects
                <select {...register('featuredOrder')} className={`${input} mt-1 normal-case text-gray-700`}>
                    <option value=''>Not featured</option>
                    <option value='1'>Position 1</option>
                    <option value='2'>Position 2</option>
                    <option value='3'>Position 3</option>
                </select>
                <span className='block normal-case text-[11px] mt-1'>Only shown when the project has a promo video.</span>
            </label>

            <div className='grid grid-cols-2 gap-2'>
                <input {...register('categoryEn')} placeholder='Category EN (e.g. Delivery app · Egypt)' className={input} />
                <input {...register('categoryAr')} placeholder='التصنيف (مثال: تطبيق توصيل · مصر)' className={input} dir='rtl' />
            </div>

            <div>
                <label className='block text-xs text-gray-400 mb-2 uppercase tracking-wide'>Feature chips (up to 3)</label>
                <div className='space-y-2'>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className='grid grid-cols-2 gap-2'>
                            <input {...register(`features.${i}.en`)} placeholder={`Feature ${i + 1} EN`} className={input} />
                            <input {...register(`features.${i}.ar`)} placeholder={`الميزة ${i + 1}`} className={input} dir='rtl' />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className='flex justify-between items-center mb-2'>
                    <label className='text-xs text-gray-400 uppercase tracking-wide'>Key results — real numbers only</label>
                    {results.fields.length < 4 && (
                        <button type='button' onClick={() => results.append({ value: '', labelEn: '', labelAr: '' })}
                            className='text-xs text-blue-600 border border-blue-300 rounded px-2.5 py-1 hover:bg-blue-50'>+ Add result</button>
                    )}
                </div>
                <div className='space-y-2'>
                    {results.fields.map((f, i) => (
                        <div key={f.id} className='grid grid-cols-[80px_1fr_1fr_auto] gap-2 items-center'>
                            <input {...register(`keyResults.${i}.value`)} placeholder='50K+' className={input} />
                            <input {...register(`keyResults.${i}.labelEn`)} placeholder='downloads' className={input} />
                            <input {...register(`keyResults.${i}.labelAr`)} placeholder='تحميل' className={input} dir='rtl' />
                            <button type='button' onClick={() => results.remove(i)} className='text-gray-300 hover:text-red-500' aria-label='Remove result'>
                                <CloseIcon className='size-4' />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
