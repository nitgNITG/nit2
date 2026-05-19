import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/prisma/client';
import { authPredict } from '@/lib/predict';

// GET — list all types (public, used by AddEditProject form)
export async function GET() {
    try {
        const types = await prisma.projectType.findMany({ orderBy: { value: 'asc' } });
        return NextResponse.json({ types }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create a new type (auth required)
export async function POST(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { value, labelEn, labelAr } = await req.json();
        if (!value || !labelEn || !labelAr)
            return NextResponse.json({ message: 'value, labelEn and labelAr are required' }, { status: 400 });

        // Normalize slug: lowercase, replace spaces with hyphens
        const slug = value.trim().toLowerCase().replace(/\s+/g, '-');
        const existing = await prisma.projectType.findUnique({ where: { value: slug } });
        if (existing)
            return NextResponse.json({ message: `Type "${slug}" already exists` }, { status: 409 });

        const type = await prisma.projectType.create({ data: { value: slug, labelEn: labelEn.trim(), labelAr: labelAr.trim() } });
        return NextResponse.json({ type, message: 'Type created' }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
