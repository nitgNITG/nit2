/**
 * Client-safe Cloudinary URL helpers (no SDK imports).
 * Safe to import from 'use client' components.
 */

/**
 * Strip any existing Cloudinary transform segment from a URL so we can
 * inject our own. Handles URLs where the upload transformation is already
 * embedded (e.g. when uploadImage sets fetch_format/quality at upload time).
 *
 * Cloudinary transform segments look like: f_auto,q_auto:good,w_700,c_limit
 * Version segments look like:              v1714000000
 * Folder/file segments have no x_y pattern.
 */
function stripCloudinaryTransforms(url: string): string {
    // Match one or more consecutive transform parameters (word_value) separated
    // by commas that immediately follow /upload/
    return url.replace(/(\/upload\/)((?:\w+_[^/,]+(?:,\w+_[^/,]+)*\/)+)/i, '$1');
}

/**
 * Inject optimization transforms into an existing Cloudinary URL.
 * Serves WebP/AVIF at the target width directly from Cloudinary CDN.
 * Handles URLs that already have transforms embedded (strips them first).
 */
export function cloudinaryOptimized(url: string, width?: number): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    // SVGs are vectors — raster transforms (f_auto, c_limit, w_N) don't apply
    if (/\.svg(\?|$)/i.test(url)) return url;
    const cleaned = stripCloudinaryTransforms(url);
    const transform = width
        ? `f_auto,q_auto:good,w_${width},c_limit`
        : `f_auto,q_auto:good`;
    return cleaned.replace('/upload/', `/upload/${transform}/`);
}

/**
 * Generate a tiny blurred placeholder URL from a Cloudinary image.
 * Used as blurDataURL for Next.js <Image placeholder="blur">.
 * Returns a 20px wide, heavily blurred version of the image.
 * Handles URLs that already have transforms embedded (strips them first).
 */
export function cloudinaryBlurUrl(url: string): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    // SVGs are vectors — e_blur and pixel-based transforms don't apply
    if (/\.svg(\?|$)/i.test(url)) return url;
    const cleaned = stripCloudinaryTransforms(url);
    return cleaned.replace('/upload/', '/upload/w_20,q_30,e_blur:800,f_auto/');
}
