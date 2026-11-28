/**
 * Cloudinary side of promo videos (server only).
 *
 * Uploads go straight from the admin's browser to Cloudinary with a signature
 * computed here — the video never passes through nginx/Next (no body-size limit),
 * and signing is pure HMAC, so it works even when this server can't reach
 * Cloudinary. Deleting is best-effort for the same reason.
 */
import { v2 as cloudinary } from 'cloudinary';

export const PROMO_FOLDER = 'nit-promos';
export type PromoUploadKind = 'video' | 'raw';

function config() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

export const promoCloudName = (): string | undefined => process.env.CLOUDINARY_CLOUD_NAME || undefined;

export type UploadSignature = {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    resourceType: PromoUploadKind;
};

/** Signed params for one direct upload (video, or a .vtt caption file as raw). */
export function signPromoUpload(kind: PromoUploadKind, now = Date.now()): UploadSignature | null {
    const c = config();
    if (!c) return null;
    const timestamp = Math.floor(now / 1000);
    const folder = kind === 'raw' ? `${PROMO_FOLDER}/captions` : PROMO_FOLDER;
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, c.apiSecret);
    return { cloudName: c.cloudName, apiKey: c.apiKey, timestamp, signature, folder, resourceType: kind };
}

/** Remove an old promo video from Cloudinary. Never throws — a leftover file is harmless. */
export async function destroyPromoVideo(publicId: string | null | undefined): Promise<void> {
    const c = config();
    if (!c || !publicId || !publicId.startsWith(`${PROMO_FOLDER}/`)) return;
    try {
        cloudinary.config({ cloud_name: c.cloudName, api_key: c.apiKey, api_secret: c.apiSecret });
        await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
    } catch (e) {
        console.warn('[promo] could not delete old video', publicId, (e as Error).message);
    }
}
