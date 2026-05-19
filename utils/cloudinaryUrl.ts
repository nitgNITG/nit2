/**
 * Client-safe Cloudinary URL helpers (no SDK imports).
 * Safe to import from 'use client' components.
 */

/**
 * Inject optimization transforms into an existing Cloudinary URL.
 * Serves WebP/AVIF at the target width directly from Cloudinary CDN.
 */
export function cloudinaryOptimized(url: string, width?: number): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (url.includes('f_auto') || url.includes('q_auto')) return url;
    const transform = width
        ? `f_auto,q_auto:good,w_${width},c_limit`
        : `f_auto,q_auto:good`;
    return url.replace('/upload/', `/upload/${transform}/`);
}

/**
 * Generate a tiny blurred placeholder URL from a Cloudinary image.
 * Used as blurDataURL for Next.js <Image placeholder="blur">.
 * Returns a 20px wide, heavily blurred version of the image.
 */
export function cloudinaryBlurUrl(url: string): string {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (url.includes('f_auto') || url.includes('q_auto')) return url;
    return url.replace('/upload/', '/upload/w_20,q_30,e_blur:800,f_auto/');
}
