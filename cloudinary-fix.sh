#!/bin/bash
set -e
cd /Users/greest/Downloads/nit2-v3

echo "📦 Installing cloudinary..."
npm install cloudinary

echo "🔧 Updating .env..."
cat > .env << 'EOF'
DATABASE_URL="mongodb+srv://nitadmin:NitG2024Pass!@nit-cluster.9re66zj.mongodb.net/nit?retryWrites=true&w=majority&appName=nit-cluster"
SECRET_JWT="SLKDFALSDJFLKA13KL14JLK32*3241LK4*/*-SDJSAKJ@32"
BASE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=dlrkykxr9
CLOUDINARY_API_KEY=777969255418941
CLOUDINARY_API_SECRET=G6soVHOuKQ-2o2VQhx87W3IiFIs
EOF
echo "✅ .env updated"

echo "🔧 Replacing firebase.ts with cloudinary..."
cat > utils/cloudinary.ts << 'EOF'
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
EOF
echo "✅ cloudinary.ts created"

echo "🔧 Updating all API routes to use cloudinary..."

# project/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' app/api/project/route.ts
# project/[id]/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' "app/api/project/[id]/route.ts"
# blog/article/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' app/api/blog/article/route.ts
# blog/article/[aricleId]/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' "app/api/blog/article/[aricleId]/route.ts"
# sponser/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' app/api/sponser/route.ts
# sponser/[id]/route.ts
sed -i '' 's|from "@/utils/firebase"|from "@/utils/cloudinary"|g' "app/api/sponser/[id]/route.ts"

echo "✅ All routes updated"

echo "🔧 Removing old firebase.ts..."
rm -f utils/firebase.ts

echo "📤 Committing and pushing..."
git add -A
git commit -m "feat: replace Firebase Storage with Cloudinary, add full logging"
git push origin main

echo ""
echo "✅ ALL DONE!"
echo ""
echo "Now restart your dev server:"
echo "  npm run dev"
echo ""
echo "Then try adding a project at http://localhost:3000/ar/dashboard/projects"
