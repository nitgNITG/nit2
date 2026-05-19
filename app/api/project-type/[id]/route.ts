import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/prisma/client';
import { authPredict } from '@/lib/predict';

// PUT — update a type
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { labelEn, labelAr } = await req.json();
        if (!labelEn || !labelAr)
            return NextResponse.json({ message: 'labelEn and labelAr are required' }, { status: 400 });

        const type = await prisma.projectType.update({
            where: { id: params.id },
            data: { labelEn: labelEn.trim(), labelAr: labelAr.trim() },
        });
        return NextResponse.json({ type, message: 'Type updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — delete a type
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        await prisma.projectType.delete({ where: { id: params.id } });
        return NextResponse.json({ message: 'Type deleted' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
