import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";
import { uploadImage, deleteImage } from "@/utils/cloudinary";
import { destroyPromoVideo } from "@/lib/promoCloudinary";
import { parseVideoUrl } from "@/lib/videos";

export const dynamic = "force-dynamic";

// GET /api/videos/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const video = await prisma.video.findUnique({ where: { id } });
        if (!video) {
            return NextResponse.json({ success: false, message: 'Video not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, video }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// PUT /api/videos/[id] (Admin only)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const { id } = params;
        const existing = await prisma.video.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ message: 'Video not found' }, { status: 404 });
        }

        const contentType = req.headers.get('content-type') || '';
        const data: any = {};

        if (contentType.includes('multipart/form-data')) {
            const formData = await req.formData();
            const title = formData.get('title') as string | null;
            const titleEn = formData.get('titleEn') as string | null;
            const description = formData.get('description') as string | null;
            const descriptionEn = formData.get('descriptionEn') as string | null;
            const videoUrl = formData.get('videoUrl') as string | null;
            const thumbnailUrl = formData.get('thumbnailUrl') as string | null;
            const duration = formData.get('duration') as string | null;
            const durationSec = formData.get('durationSec');
            const category = formData.get('category') as string | null;
            const categoryAr = formData.get('categoryAr') as string | null;
            const categoryEn = formData.get('categoryEn') as string | null;
            const order = formData.get('order');
            const isFeatured = formData.get('isFeatured');

            if (title !== null) data.title = title;
            if (titleEn !== null) data.titleEn = titleEn;
            if (description !== null) data.description = description;
            if (descriptionEn !== null) data.descriptionEn = descriptionEn;
            if (videoUrl !== null) data.videoUrl = videoUrl;
            if (thumbnailUrl !== null) data.thumbnailUrl = thumbnailUrl;
            if (duration !== null) data.duration = duration;
            if (durationSec !== null) data.durationSec = parseFloat(durationSec as string);
            if (category !== null) data.category = category;
            if (categoryAr !== null) data.categoryAr = categoryAr;
            if (categoryEn !== null) data.categoryEn = categoryEn;
            if (order !== null) data.order = parseInt(order as string, 10);
            if (isFeatured !== null) data.isFeatured = isFeatured === 'true';

            // New thumbnail file uploaded
            const thumbFile = formData.get('thumbnailFile') as File | null;
            if (thumbFile && thumbFile.size > 0) {
                if (existing.thumbnailUrl && existing.thumbnailUrl.startsWith('/uploads/')) {
                    await deleteImage(existing.thumbnailUrl);
                }
                const uploaded = await uploadImage(thumbFile, 'videos');
                if (uploaded) data.thumbnailUrl = uploaded;
            }
        } else {
            const json = await req.json();
            if (json.title !== undefined) data.title = json.title;
            if (json.titleEn !== undefined) data.titleEn = json.titleEn;
            if (json.description !== undefined) data.description = json.description;
            if (json.descriptionEn !== undefined) data.descriptionEn = json.descriptionEn;
            if (json.videoUrl !== undefined) data.videoUrl = json.videoUrl;
            if (json.thumbnailUrl !== undefined) data.thumbnailUrl = json.thumbnailUrl;
            if (json.duration !== undefined) data.duration = json.duration;
            if (json.durationSec !== undefined) data.durationSec = json.durationSec;
            if (json.category !== undefined) data.category = json.category;
            if (json.categoryAr !== undefined) data.categoryAr = json.categoryAr;
            if (json.categoryEn !== undefined) data.categoryEn = json.categoryEn;
            if (json.order !== undefined) data.order = parseInt(json.order, 10);
            if (json.isFeatured !== undefined) data.isFeatured = !!json.isFeatured;
        }

        // If thumbnail empty, try auto-generating from videoUrl if changed
        if (!data.thumbnailUrl && data.videoUrl) {
            const parsed = parseVideoUrl(data.videoUrl);
            if (parsed.thumbnailUrl) {
                data.thumbnailUrl = parsed.thumbnailUrl;
            }
        }

        const updated = await prisma.video.update({
            where: { id },
            data,
        });

        return NextResponse.json({ success: true, video: updated, message: 'Video updated successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('[PUT /api/videos/[id]] Error:', error.message);
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}

// DELETE /api/videos/[id] (Admin only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const { id } = params;
        const video = await prisma.video.findUnique({ where: { id } });
        if (!video) {
            return NextResponse.json({ message: 'Video not found' }, { status: 404 });
        }

        // Clean up Cloudinary asset if applicable
        if (video.publicId) {
            await destroyPromoVideo(video.publicId);
        }
        // Clean up local thumbnail if applicable
        if (video.thumbnailUrl && video.thumbnailUrl.startsWith('/uploads/')) {
            await deleteImage(video.thumbnailUrl);
        }

        await prisma.video.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Video deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('[DELETE /api/videos/[id]] Error:', error.message);
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}
