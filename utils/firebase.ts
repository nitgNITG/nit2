import admin from 'firebase-admin';
const serviceAccount = require('./nextjs-2-2528c-firebase-adminsdk-wj4hg-be09aa6429.json');
import { Storage } from '@google-cloud/storage';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'gs://nextjs-2-2528c.appspot.com',
    });
}

const bucket = admin.storage().bucket();
export const uploadImage = async (file: File, destination: string): Promise<string | null> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const blob = bucket.file(destination);
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: file.type,
            },
        });

        return new Promise((resolve, reject) => {
            blobStream.on('error', (error) => {
                console.error('Error uploading image:', error);
                reject(null);
            });

            blobStream.on('finish', async () => {
                try {
                    await blob.makePublic();
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
                    resolve(publicUrl);
                } catch (error) {
                    reject(null);
                }
            });
            blobStream.end(buffer);
        });
    } catch (error) {
        return null;
    }
};
export const deleteImage = async (fileUrl: string): Promise<boolean> => {
    try {
        const urlParts = new URL(fileUrl);
        const filePath = decodeURIComponent(urlParts.pathname.replace(`/${bucket.name}/`, ''));
        const file = bucket.file(filePath);
        await file.delete();
        return true;
    } catch (error) {
        return false;
    }
};