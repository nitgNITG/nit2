import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file to Cloudinary with auto quality + format optimization.
 * Eager transforms pre-generate 800px and 400px WebP/AVIF variants for fast CDN delivery.
 */
export const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    console.log(`[Cloudinary] Uploading to folder: ${folder}, size: ${file?.size}`);
    try {
        if (!file || file.size === 0) {
            console.error('[Cloudinary] ❌ Invalid file');
            return null;
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new Promise((resolve) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    // Serve best format (WebP/AVIF) at best quality automatically
                    transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
                    // Pre-generate common responsive widths asynchronously
                    eager: [
                        { width: 1200, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
                        { width: 800,  crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
                        { width: 400,  crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
                    ],
                    eager_async: true,
                },
                (error, result) => {
                    if (error) {
                        console.error('[Cloudinary] ❌ Upload error:', error.message);
                        resolve(null);
                    } else {
                        console.log('[Cloudinary] ✅ Uploaded:', result?.secure_url);
                        resolve(result?.secure_url ?? null);
                    }
                }
            );
            uploadStream.end(buffer);
        });
    } catch (error: any) {
        console.error('[Cloudinary] ❌ Exception:', error.message);
        return null;
    }
};

export const deleteImage = async (imageUrl: string): Promise<boolean> => {
    console.log(`[Cloudinary] Deleting: ${imageUrl}`);
    try {
        if (!imageUrl) return true;
        const parts = imageUrl.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) { console.warn('[Cloudinary] ⚠️ Cannot parse URL'); return true; }
        const afterUpload = parts.slice(uploadIndex + 1);
        if (afterUpload[0]?.startsWith('v')) afterUpload.shift();
        // Skip any transformation segment (e.g. "f_auto,q_auto")
        if (!afterUpload[0]?.includes('.') && afterUpload[0]?.includes('_')) afterUpload.shift();
        const publicIdWithExt = afterUpload.join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
        console.log('[Cloudinary] ✅ Deleted:', publicId);
        return true;
    } catch (error: any) {
        console.error('[Cloudinary] ❌ Delete error:', error.message);
        return false;
    }
};

/**
 * Inject Cloudinary image optimization transforms into an existing secure_url.
 * Use for displaying already-uploaded images at the right size and format.
 *
 * @param url    Cloudinary secure_url as stored in DB
 * @param width  Target display width in pixels (used for w_ param)
 */
export function cloudinaryOptimized(url: string, width?: number): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    // Don't double-inject transforms
    if (url.includes('f_auto') || url.includes('q_auto')) return url;
    const transform = width
        ? `f_auto,q_auto:good,w_${width},c_limit`
        : `f_auto,q_auto:good`;
    return url.replace('/upload/', `/upload/${transform}/`);
}
