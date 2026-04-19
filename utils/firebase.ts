import admin from 'firebase-admin';
import path from 'path';

if (!admin.apps.length) {
    try {
        const serviceAccountPath = path.join(process.cwd(), 'utils', 'nextjs-2-2528c-firebase-adminsdk-wj4hg-be09aa6429.json');
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: 'gs://nextjs-2-2528c.appspot.com',
        });
        console.log('[Firebase] ✅ Initialized successfully');
    } catch (err: any) {
        console.error('[Firebase] ❌ Failed to initialize:', err.message);
    }
}

const getBucket = () => {
    if (!admin.apps.length) { console.error('[Firebase] ❌ No app initialized'); return null; }
    return admin.storage().bucket();
};

export const uploadImage = async (file: File, destination: string): Promise<string | null> => {
    console.log('[Firebase] Uploading:', destination, 'size:', file?.size);
    try {
        const bucket = getBucket();
        if (!bucket || !file || !file.size) { console.error('[Firebase] ❌ Invalid bucket or file'); return null; }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const blob = bucket.file(destination);
        const blobStream = blob.createWriteStream({ metadata: { contentType: file.type || 'image/jpeg' } });
        return new Promise((resolve) => {
            blobStream.on('error', (error) => { console.error('[Firebase] ❌ Stream error:', error.message); resolve(null); });
            blobStream.on('finish', async () => {
                try {
                    await blob.makePublic();
                    const url = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
                    console.log('[Firebase] ✅ Uploaded:', url);
                    resolve(url);
                } catch (e: any) { console.error('[Firebase] ❌ makePublic failed:', e.message); resolve(null); }
            });
            blobStream.end(buffer);
        });
    } catch (error: any) { console.error('[Firebase] ❌ Exception:', error.message); return null; }
};

export const deleteImage = async (fileUrl: string): Promise<boolean> => {
    try {
        if (!fileUrl || !fileUrl.startsWith('https://')) { console.warn('[Firebase] ⚠️ Invalid URL, skipping delete'); return true; }
        const bucket = getBucket();
        if (!bucket) return false;
        const urlParts = new URL(fileUrl);
        const filePath = decodeURIComponent(urlParts.pathname.replace('/' + bucket.name + '/', ''));
        await bucket.file(filePath).delete();
        console.log('[Firebase] ✅ Deleted:', filePath);
        return true;
    } catch (error: any) { console.error('[Firebase] ❌ Delete error:', error.message); return false; }
};
