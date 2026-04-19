import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
                { folder, resource_type: 'image' },
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
        // Extract public_id from URL
        // URL format: https://res.cloudinary.com/cloud/image/upload/v123/folder/filename.jpg
        const parts = imageUrl.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) { console.warn('[Cloudinary] ⚠️ Cannot parse URL'); return true; }
        // Skip version segment (v12345) if present
        const afterUpload = parts.slice(uploadIndex + 1);
        if (afterUpload[0]?.startsWith('v')) afterUpload.shift();
        const publicIdWithExt = afterUpload.join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // remove extension
        await cloudinary.uploader.destroy(publicId);
        console.log('[Cloudinary] ✅ Deleted:', publicId);
        return true;
    } catch (error: any) {
        console.error('[Cloudinary] ❌ Delete error:', error.message);
        return false;
    }
};
