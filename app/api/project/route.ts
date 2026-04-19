import { uploadImage } from "@/utils/cloudinary";
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

        const url = await uploadImage(img, 'projects');
        if (!url) { console.error('[POST /api/project] ❌ Upload failed'); return NextResponse.json({ message: 'Failed to upload image — check Cloudinary config' }, { status: 500 }); }

        const project = await prisma.project.create({
            data: { img: url, title, description, titleEn, descriptionEn, type: type || 'project', important: important === 'true' }
        });
        console.log('[POST /api/project] ✅ Created:', project.id);
        return NextResponse.json({ project, message: 'Successfully Created' }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/project] ❌', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error — check terminal logs' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'project';
        const important = searchParams.get('important');
        const lang = searchParams.get('lang');
        const dashboard = searchParams.get('dashboard');

        // dashboard=true → return ALL fields for the admin table
        // lang=en → return English fields for public EN pages
        // default → return Arabic fields for public AR pages
        const select: any = { img: true, id: true };
        if (dashboard === 'true') {
            select.title = true;
            select.description = true;
            select.titleEn = true;
            select.descriptionEn = true;
            select.important = true;
            select.type = true;
        } else if (lang === 'en') {
            select.titleEn = true;
            select.descriptionEn = true;
        } else {
            select.title = true;
            select.description = true;
        }

        const where: any = { type };
        if (important) where.important = true;

        const projects = await prisma.project.findMany({ where, select });
        console.log(`[GET /api/project] ✅ type=${type} lang=${lang} dashboard=${dashboard} → ${projects.length} results`);
        return NextResponse.json({ data: projects }, { status: 200 });
    } catch (error: any) {
        console.error('[GET /api/project] ❌', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}
