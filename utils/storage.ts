/**
 * Server-side image storage using the local filesystem.
 *
 * Development: saves to /public/uploads/<folder>/ (served by Next.js)
 * Production:  saves to UPLOAD_DIR env var (e.g. /var/www/nit-uploads/)
 *              served by nginx directly at /uploads/
 *
 * Set in .env on the server:
 *   UPLOAD_DIR=/var/www/nit-uploads
 *   UPLOAD_URL_PREFIX=/uploads
 */
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

/**
 * Resolve the filesystem directory and public URL prefix for uploads.
 *
 * If UPLOAD_DIR is set → use that external folder + UPLOAD_URL_PREFIX for URLs.
 * Otherwise           → fall back to /public/uploads (dev / localhost).
 */
function getUploadPaths(folder: string): { dir: string; urlPrefix: string } {
    const externalDir = process.env.UPLOAD_DIR;
    const urlPrefix = process.env.UPLOAD_URL_PREFIX ?? '/uploads';

    if (externalDir) {
        return {
            dir: path.join(externalDir, folder),
            urlPrefix,
        };
    }

    // Localhost fallback — inside /public so Next.js serves it
    return {
        dir: path.join(process.cwd(), 'public', 'uploads', folder),
        urlPrefix: '/uploads',
    };
}

/**
 * Save an uploaded File to the configured upload directory as WebP.
 * Returns the public URL (e.g. "/uploads/projects/1234567890.webp") or null.
 */
export const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    console.log(`[Storage] Uploading to folder: ${folder}, size: ${file?.size}`);
    try {
        if (!file || file.size === 0) {
            console.error('[Storage] ❌ Invalid file');
            return null;
        }

        const { dir, urlPrefix } = getUploadPaths(folder);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Ensure the upload directory exists
        fs.mkdirSync(dir, { recursive: true });

        // Unique filename based on timestamp
        const filename = `${Date.now()}.webp`;
        const filepath = path.join(dir, filename);

        // Resize to max 1200px on either axis, convert to WebP quality 85
        await sharp(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);

        // Ensure nginx (www-data) can read the file and directory
        fs.chmodSync(filepath, 0o644);
        fs.chmodSync(dir, 0o755);

        const publicUrl = `${urlPrefix}/${folder}/${filename}`;
        console.log('[Storage] ✅ Saved:', publicUrl);
        return publicUrl;
    } catch (error: any) {
        console.error('[Storage] ❌ Error:', error.message);
        return null;
    }
};

/**
 * Delete an uploaded image.
 * Handles both /uploads/... paths (local) and legacy res.cloudinary.com URLs (skipped).
 */
export const deleteImage = async (imageUrl: string): Promise<boolean> => {
    console.log(`[Storage] Deleting: ${imageUrl}`);
    try {
        // Legacy Cloudinary URLs — nothing to delete locally
        if (!imageUrl || imageUrl.includes('res.cloudinary.com')) {
            console.log('[Storage] ⚠️  Skipping Cloudinary URL (legacy)');
            return true;
        }

        const urlPrefix = process.env.UPLOAD_URL_PREFIX ?? '/uploads';
        if (!imageUrl.startsWith(urlPrefix)) {
            console.warn('[Storage] ⚠️  Unrecognised URL pattern, skipping');
            return true;
        }

        let filepath: string;
        const externalDir = process.env.UPLOAD_DIR;
        if (externalDir) {
            // Strip the URL prefix, resolve under UPLOAD_DIR
            const relative = imageUrl.slice(urlPrefix.length); // e.g. /articles/123.webp
            filepath = path.join(externalDir, relative);
        } else {
            filepath = path.join(process.cwd(), 'public', imageUrl);
        }

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
