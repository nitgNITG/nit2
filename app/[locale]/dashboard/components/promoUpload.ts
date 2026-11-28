'use client'
import axios from 'axios'

// Direct browser → Cloudinary upload, signed by /api/project/promo/sign (admin only).
// Large videos go up in 20 MB chunks (Cloudinary's chunked-upload protocol), so a
// long promo never hits a single-request size limit and progress is accurate.

export type CloudinaryUpload = {
    secure_url: string
    public_id: string
    duration?: number
    created_at?: string
    bytes?: number
}

const CHUNK = 20 * 1024 * 1024

function postChunk(url: string, form: FormData, headers: Record<string, string>, onProgress: (loaded: number) => void): Promise<CloudinaryUpload> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', url)
        for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
        xhr.upload.onprogress = (e) => onProgress(e.loaded)
        xhr.onload = () => {
            let body: any = {}
            try { body = JSON.parse(xhr.responseText) } catch { /* keep {} */ }
            if (xhr.status >= 200 && xhr.status < 300) resolve(body)
            else reject(new Error(body?.error?.message || `Upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('Network error while uploading'))
        xhr.send(form)
    })
}

export async function uploadPromoFile(file: File, kind: 'video' | 'raw', onProgress: (fraction: number) => void): Promise<CloudinaryUpload> {
    const { data: sig } = await axios.post('/api/project/promo/sign', { kind })
    const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`
    const uniqueId = `promo-${Date.now()}-${Math.random().toString(36).slice(2)}`
    let result: CloudinaryUpload | null = null
    for (let start = 0; start < file.size || start === 0; start += CHUNK) {
        const end = Math.min(start + CHUNK, file.size)
        const form = new FormData()
        form.append('file', file.slice(start, end), file.name)
        form.append('api_key', sig.apiKey)
        form.append('timestamp', String(sig.timestamp))
        form.append('signature', sig.signature)
        form.append('folder', sig.folder)
        const headers: Record<string, string> = file.size > CHUNK
            ? { 'X-Unique-Upload-Id': uniqueId, 'Content-Range': `bytes ${start}-${end - 1}/${file.size}` }
            : {}
        result = await postChunk(url, form, headers, (loaded) => onProgress(Math.min(1, (start + loaded) / Math.max(1, file.size))))
        if (end >= file.size) break
    }
    if (!result?.secure_url) throw new Error('Cloudinary did not return a file URL')
    onProgress(1)
    return result
}
