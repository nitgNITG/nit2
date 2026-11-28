import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";
import { uploadImage } from "@/utils/cloudinary";
import { parseVideoUrl } from "@/lib/videos";

export const dynamic = "force-dynamic";

// GET /api/videos
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const featured = searchParams.get('featured');
        const search = searchParams.get('search');
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : undefined;

        const where: any = {};
        if (category && category !== 'all') {
            where.category = category;
        }
        if (featured === 'true') {
            where.isFeatured = true;
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { titleEn: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { descriptionEn: { contains: search, mode: 'insensitive' } },
            ];
        }

        const videos = await prisma.video.findMany({
            where,
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' },
            ],
            take: limit,
        });

        const total = await prisma.video.count({ where });

        return NextResponse.json({ success: true, videos, total }, { status: 200 });
    } catch (error: any) {
        console.error('[GET /api/videos] Error:', error.message);
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}

// POST /api/videos (Admin only)
export async function POST(req: NextRequest) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const contentType = req.headers.get('content-type') || '';
        let title = '';
        let titleEn = '';
        let description = '';
        let descriptionEn = '';
        let videoUrl = '';
        let thumbnailUrl = '';
        let duration = '';
        let durationSec: number | null = null;
        let category = 'showcase';
        let categoryAr = '';
        let categoryEn = '';
        let publicId: string | null = null;
        let order = 0;
        let isFeatured = false;

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            title = (formData.get('title') as string) || '';
            titleEn = (formData.get('titleEn') as string) || '';
            description = (formData.get('description') as string) || '';
            descriptionEn = (formData.get('descriptionEn') as string) || '';
            videoUrl = (formData.get('videoUrl') as string) || '';
            thumbnailUrl = (formData.get('thumbnailUrl') as string) || '';
            duration = (formData.get('duration') as string) || '';
            const rawSec = formData.get('durationSec');
            if (rawSec) durationSec = parseFloat(rawSec as string);
            category = (formData.get('category') as string) || 'showcase';
            categoryAr = (formData.get('categoryAr') as string) || '';
            categoryEn = (formData.get('categoryEn') as string) || '';
            publicId = (formData.get('publicId') as string) || null;
            const rawOrder = formData.get('order');
            if (rawOrder) order = parseInt(rawOrder as string, 10);
            isFeatured = formData.get('isFeatured') === 'true';

            // Check if user uploaded a thumbnail image file
            const thumbFile = formData.get('thumbnailFile') as File | null;
            if (thumbFile && thumbFile.size > 0) {
                const uploadedThumb = await uploadImage(thumbFile, 'videos');
                if (uploadedThumb) {
                    thumbnailUrl = uploadedThumb;
                }
            }
        } else {
            const json = await req.json();
            title = json.title || '';
            titleEn = json.titleEn || '';
            description = json.description || '';
            descriptionEn = json.descriptionEn || '';
            videoUrl = json.videoUrl || '';
            thumbnailUrl = json.thumbnailUrl || '';
            duration = json.duration || '';
            durationSec = json.durationSec != null ? parseFloat(json.durationSec) : null;
            category = json.category || 'showcase';
            categoryAr = json.categoryAr || '';
            categoryEn = json.categoryEn || '';
            publicId = json.publicId || null;
            order = json.order != null ? parseInt(json.order, 10) : 0;
            isFeatured = !!json.isFeatured;
        }

        if (!title.trim()) {
            return NextResponse.json({ message: 'Arabic title is required' }, { status: 400 });
        }
        if (!videoUrl.trim()) {
            return NextResponse.json({ message: 'Video URL or file is required' }, { status: 400 });
        }

        // If no thumbnail provided, try auto-generating from video source (e.g. YouTube / Cloudinary)
        if (!thumbnailUrl.trim()) {
            const parsed = parseVideoUrl(videoUrl);
            if (parsed.thumbnailUrl) {
                thumbnailUrl = parsed.thumbnailUrl;
            }
        }

        // Auto-assign order if not set
        if (!order) {
            const lastVideo = await prisma.video.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = (lastVideo?.order ?? -1) + 1;
        }

        const video = await prisma.video.create({
            data: {
                title,
                titleEn: titleEn || null,
                description: description || null,
                descriptionEn: descriptionEn || null,
                videoUrl,
                thumbnailUrl: thumbnailUrl || null,
                duration: duration || null,
                durationSec,
                category,
                categoryAr: categoryAr || null,
                categoryEn: categoryEn || null,
                publicId,
                order,
                isFeatured,
            },
        });

        return NextResponse.json({ success: true, video, message: 'Video created successfully' }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/videos] Error:', error.message);
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}
