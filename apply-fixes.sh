#!/bin/bash
set -e
cd /Users/greest/Downloads/nit2-v3

echo "📥 Pulling latest from GitHub..."
git pull origin main

echo "🔧 Applying all fixes..."

# utils/firebase.ts
cat > utils/firebase.ts << 'EOF'
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
EOF

echo "✅ firebase.ts fixed"

# lib/predict.ts
cat > lib/predict.ts << 'EOF'
import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const authPredict = (req: NextRequest): boolean => {
    try {
        let token = '';
        if (req) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            } else {
                token = cookies().get('token')?.value ?? '';
            }
        }
        if (!token) { console.warn('[Auth] ❌ No token'); return false; }
        const secret = process.env.SECRET_JWT;
        if (!secret) { console.error('[Auth] ❌ SECRET_JWT not set'); return false; }
        const decoded = jwt.verify(token, secret) as JwtPayload;
        const isValid = !!decoded?.id;
        console.log('[Auth]', isValid ? '✅ Valid' : '❌ Invalid');
        return isValid;
    } catch (error: any) { console.error('[Auth] ❌ Verify failed:', error.message); return false; }
};
EOF
echo "✅ predict.ts fixed"

echo ""
echo "🔧 Fixing API routes..."

# project/route.ts
cat > app/api/project/route.ts << 'EOF'
import { uploadImage } from "@/utils/firebase";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client';
import { authPredict } from "@/lib/predict";

export async function POST(req: NextRequest) {
    console.log('[POST /api/project]');
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const body = await req.formData();
        const img = body.get('img') as File | null;
        const title = body.get('title') as string | null;
        const description = body.get('description') as string | null;
        const titleEn = body.get('titleEn') as string | null;
        const descriptionEn = body.get('descriptionEn') as string | null;
        const important = body.get('important') as string | null;
        const type = body.get('type') as string | null;
        console.log('[POST /api/project] Fields:', { title, titleEn, type, hasImg: !!img, imgSize: img?.size });
        if (!img || !title || !description || !titleEn || !descriptionEn)
            return NextResponse.json({ message: 'Missing required fields', missing: { img: !img, title: !title, description: !description, titleEn: !titleEn, descriptionEn: !descriptionEn } }, { status: 400 });
        const url = await uploadImage(img, 'projects/' + Date.now());
        if (!url) { console.error('[POST /api/project] ❌ Upload failed'); return NextResponse.json({ message: 'Failed to upload image — check Firebase config' }, { status: 500 }); }
        const project = await prisma.project.create({ data: { img: url, title, description, titleEn, descriptionEn, type: type || 'project', important: important === 'true' } });
        console.log('[POST /api/project] ✅ Created:', project.id);
        return NextResponse.json({ project, message: 'Successfully Created' }, { status: 201 });
    } catch (error: any) { console.error('[POST /api/project] ❌', error.message); return NextResponse.json({ error: error.message, message: 'Server error — check terminal logs' }, { status: 500 }); }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'project';
        const important = searchParams.get('important');
        const lang = searchParams.get('lang');
        const select: any = { img: true, id: true };
        if (lang === 'en') { select.titleEn = true; select.descriptionEn = true; }
        else { select.title = true; select.description = true; }
        const where: any = { type };
        if (important) where.important = true;
        const projects = await prisma.project.findMany({ where, select });
        return NextResponse.json({ data: projects }, { status: 200 });
    } catch (error: any) { return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 }); }
}
EOF
echo "✅ project/route.ts fixed"

# contact/route.ts — CRITICAL: remove auth from POST
cat > app/api/contact/route.ts << 'EOF'
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client';
import { authPredict } from "@/lib/predict";

export async function POST(req: NextRequest) {
    console.log('[POST /api/contact]');
    try {
        const { name, email, subject, message } = await req.json();
        if (!name || !email || !subject || !message)
            return NextResponse.json({ message: 'يرجي ادخال جميع البيانات' }, { status: 400 });
        await prisma.contact.create({ data: { name, email, subject, message } });
        console.log('[POST /api/contact] ✅ Saved from:', email);
        return NextResponse.json({ message: 'تم الارسال بنجاح' }, { status: 201 });
    } catch (error: any) { console.error('[POST /api/contact] ❌', error.message); return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 }); }
}

export async function GET(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const isRead = searchParams.get('isRead');
        if (isRead) {
            const count = await prisma.contact.count({ where: { isReaded: false } });
            return NextResponse.json({ count }, { status: 200 });
        }
        const skip = parseInt(searchParams.get('skip') || '0');
        const contacts = await prisma.contact.findMany({ skip, take: 17, orderBy: { createdAt: 'asc' } });
        return NextResponse.json({ contacts }, { status: 200 });
    } catch (error: any) { return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        await prisma.contact.updateMany({ data: { isReaded: true } });
        return NextResponse.json({ message: 'Successfully updated' }, { status: 200 });
    } catch (error: any) { return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 }); }
}
EOF
echo "✅ contact/route.ts fixed (removed auth from POST)"

echo ""
echo "📤 Committing and pushing to GitHub..."
git add -A
git commit -m "fix: CRUD logging, firebase error handling, contact auth, image upload"
git push origin main

echo ""
echo "✅ ALL DONE! Now restart your dev server:"
echo "   npm run dev"
echo ""
echo "Then test adding a project at http://localhost:3000/ar/dashboard/projects"
