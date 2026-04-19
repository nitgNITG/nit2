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
