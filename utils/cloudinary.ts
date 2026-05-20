/**
 * Image upload/delete now uses local server storage (utils/storage.ts).
 * Cloudinary SDK kept only for reference — no longer used for new uploads.
 *
 * All new images are saved to /public/uploads/<folder>/ as WebP via sharp.
 * Legacy images still stored as Cloudinary URLs in the DB work as-is
 * (displayed with `unoptimized` in the Image components).
 */

// Re-export upload/delete from local storage
export { uploadImage, deleteImage } from './storage';

// Re-export the canonical client-safe URL helpers
export { cloudinaryOptimized, cloudinaryBlurUrl } from './cloudinaryUrl';
