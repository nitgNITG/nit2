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
        const typesRaw = body.get('types') as string | null;
        const linksRaw = body.get('links') as string | null;

        console.log('[POST /api/project] Fields:', { title, titleEn, typesRaw, hasImg: !!img, imgSize: img?.size });

        if (!img || !title || !description || !titleEn || !descriptionEn)
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });

        const url = await uploadImage(img, 'projects');
        if (!url) return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 });

        let types: string[] = [];
        try { if (typesRaw) types = JSON.parse(typesRaw); } catch { types = ['lms']; }
        if (types.length === 0) types = ['lms'];

        let links: { headerEn: string; headerAr: string; link: string }[] = [];
        try { if (linksRaw) links = JSON.parse(linksRaw); } catch { links = []; }

        const lastProject = await prisma.project.findFirst({ orderBy: { order: 'desc' }, select: { order: true } });
        const nextOrder = (lastProject?.order ?? -1) + 1;

        const project = await prisma.project.create({
            data: { img: url, title, description, titleEn, descriptionEn, types, important: important === 'true', links, order: nextOrder }
        });
        console.log('[POST /api/project] ✅ Created:', project.id);
        return NextResponse.json({ project, message: 'Successfully Created' }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/project] ❌', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        // type=all (or omitted) → no filter; otherwise filter where types array has the value
        const typeParam = searchParams.get('type');
        const important = searchParams.get('important');
        const lang = searchParams.get('lang');
        const dashboard = searchParams.get('dashboard');

        const select: any = { img: true, id: true, types: true };
        if (dashboard === 'true') {
            select.title = true;
            select.description = true;
            select.titleEn = true;
            select.descriptionEn = true;
            select.important = true;
            select.links = true;
        } else if (lang === 'en') {
            select.titleEn = true;
            select.descriptionEn = true;
            select.links = true;
        } else {
            select.title = true;
            select.description = true;
            select.links = true;
        }

        const where: any = {};
        // Filter by type unless 'all' or omitted (home page marquee shows everything)
        if (typeParam && typeParam !== 'all') {
            where.types = { has: typeParam };
        }
        if (important) where.important = true;

        const projects = await prisma.project.findMany({ where, select, orderBy: { order: 'asc' } });
        console.log(`[GET /api/project] ✅ type=${typeParam ?? 'all'} lang=${lang} dashboard=${dashboard} → ${projects.length} results`);
        return NextResponse.json({ data: projects }, { status: 200 });
    } catch (error: any) {
        console.error('[GET /api/project] ❌', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}
