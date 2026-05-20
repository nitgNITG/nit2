/**
 * Server-side image storage using the local filesystem.
 * Saves uploaded images to /public/uploads/<folder>/ as optimised WebP.
 * Files are served by Next.js static file serving at /uploads/<folder>/<file>.
 *
 * Replaces Cloudinary upload/delete — no external CDN dependency.
 */
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

/**
 * Save an uploaded File to /public/uploads/<folder>/ as WebP.
 * Returns the public URL path  (e.g. "/uploads/projects/1234567890.webp")
 * or null on failure.
 */
export const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    console.log(`[Storage] Uploading to folder: ${folder}, size: ${file?.size}`);
    try {
        if (!file || file.size === 0) {
            console.error('[Storage] ❌ Invalid file');
            return null;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Ensure the upload directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
        fs.mkdirSync(uploadDir, { recursive: true });

        // Unique filename based on timestamp
        const filename = `${Date.now()}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Resize to max 1200px on either axis, convert to WebP quality 85
        await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);

        const publicUrl = `/uploads/${folder}/${filename}`;
        console.log('[Storage] ✅ Saved:', publicUrl);
        return publicUrl;
    } catch (error: any) {
        console.error('[Storage] ❌ Error:', error.message);
        return null;
    }
};

/**
 * Delete an uploaded image from /public/uploads/.
 * Silently ignores Cloudinary URLs (legacy images) and missing files.
 */
export const deleteImage = async (imageUrl: string): Promise<boolean> => {
    console.log(`[Storage] Deleting: ${imageUrl}`);
    try {
        // Legacy Cloudinary URLs — nothing to delete locally
        if (!imageUrl || imageUrl.includes('res.cloudinary.com')) {
            console.log('[Storage] ⚠️  Skipping Cloudinary URL (legacy image)');
            return true;
        }
        if (!imageUrl.startsWith('/uploads/')) {
            console.warn('[Storage] ⚠️  Unrecognised URL pattern, skipping');
            return true;
        }

        const filepath = path.join(process.cwd(), 'public', imageUrl);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            console.log('[Storage] ✅ Deleted:', filepath);
        } else {
            console.warn('[Storage] ⚠️  File not found:', filepath);
        }
        return true;
    } catch (error: any) {
        console.error('[Storage] ❌ Delete error:', error.message);
        return false;
    }
};
