import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";
import { DEFAULT_VIDEO_CATEGORIES } from "@/lib/videos";

export const dynamic = "force-dynamic";

// GET /api/video-categories
export async function GET() {
    try {
        let categories = await prisma.videoCategory.findMany({
            orderBy: { order: 'asc' },
        });

        // Seed defaults if empty
        if (!categories || categories.length === 0) {
            for (let i = 0; i < DEFAULT_VIDEO_CATEGORIES.length; i++) {
                const def = DEFAULT_VIDEO_CATEGORIES[i];
                await prisma.videoCategory.create({
                    data: {
                        value: def.value,
                        labelAr: def.labelAr,
                        labelEn: def.labelEn,
                        order: i,
                    },
                });
            }
            categories = await prisma.videoCategory.findMany({
                orderBy: { order: 'asc' },
            });
        }

        return NextResponse.json({ success: true, categories }, { status: 200 });
    } catch (error: any) {
        console.error('[GET /api/video-categories] Error:', error.message);
        // Fallback to default in-memory list if DB error
        return NextResponse.json({ success: true, categories: DEFAULT_VIDEO_CATEGORIES }, { status: 200 });
    }
}

// POST /api/video-categories (Admin only)
export async function POST(req: NextRequest) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const body = await req.json();
        const { labelAr, labelEn, value } = body;

        if (!labelAr || !labelEn) {
            return NextResponse.json({ message: 'Arabic and English names are required' }, { status: 400 });
        }

        // Generate slug value if not provided
        const slug = (value || labelEn || labelAr)
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;

        const last = await prisma.videoCategory.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true },
        });
        const order = (last?.order ?? -1) + 1;

        const category = await prisma.videoCategory.create({
            data: {
                value: slug,
                labelAr,
                labelEn,
                order,
            },
        });

        return NextResponse.json({ success: true, category, message: 'Category created' }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/video-categories] Error:', error.message);
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}
