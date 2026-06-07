import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client';
import { authPredict } from "@/lib/predict";
import { computeLeadScore } from "@/utils/leadScore";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, phone, subject, message, service, budget, timeline, role, pain } = body;

        if (!name || !email || !phone || !subject || !message)
            return NextResponse.json({ message: 'يرجي ادخال جميع البيانات' }, { status: 400 });

        const { score, stage } = computeLeadScore({ email, phone, role, service, budget, timeline, pain, message });

        await prisma.contact.create({
            data: { name, email, phone, subject, message, service, budget, timeline, role, pain, score, stage },
        });

        console.log(`[Contact] ✅ ${email} → stage:${stage} score:${score}`);
        return NextResponse.json({ message: 'تم الارسال بنجاح' }, { status: 201 });
    } catch (error: any) {
        console.error('[Contact POST]', error.message);
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });

        const { searchParams } = new URL(req.url);

        // Unread count
        if (searchParams.get('isRead')) {
            const count = await prisma.contact.count({ where: { isReaded: false } });
            return NextResponse.json({ count }, { status: 200 });
        }

        // Funnel summary
        if (searchParams.get('summary')) {
            const [lead, mql, sql, opportunity] = await Promise.all([
                prisma.contact.count({ where: { stage: 'lead' } }),
                prisma.contact.count({ where: { stage: 'mql' } }),
                prisma.contact.count({ where: { stage: 'sql' } }),
                prisma.contact.count({ where: { stage: 'opportunity' } }),
            ]);
            return NextResponse.json({ lead, mql, sql, opportunity }, { status: 200 });
        }

        // Paginated list (with optional stage/status filter)
        const skip  = parseInt(searchParams.get('skip')   || '0');
        const stage  = searchParams.get('stage')  || undefined;
        const status = searchParams.get('status') || undefined;

        const contacts = await prisma.contact.findMany({
            where: { ...(stage ? { stage } : {}), ...(status ? { status } : {}) },
            skip,
            take: 20,
            orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        });
        return NextResponse.json({ contacts }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Mark all as read
export async function PUT(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        await prisma.contact.updateMany({ data: { isReaded: true } });
        return NextResponse.json({ message: 'Successfully updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Delete a contact by id
export async function DELETE(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
        await prisma.contact.delete({ where: { id } });
        return NextResponse.json({ message: 'Deleted' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}

// Update status / notes per contact
export async function PATCH(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        const { id, status, notes } = await req.json();
        if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
        const updated = await prisma.contact.update({
            where: { id },
            data: { ...(status ? { status } : {}), ...(notes !== undefined ? { notes } : {}) },
        });
        return NextResponse.json({ contact: updated }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: 'Server error' }, { status: 500 });
    }
}
