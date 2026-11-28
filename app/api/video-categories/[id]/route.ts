import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";

export const dynamic = "force-dynamic";

// PUT /api/video-categories/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const { id } = params;
        const body = await req.json();
        const { labelAr, labelEn, value, order } = body;

        const data: any = {};
        if (labelAr !== undefined) data.labelAr = labelAr;
        if (labelEn !== undefined) data.labelEn = labelEn;
        if (value !== undefined) data.value = value;
        if (order !== undefined) data.order = parseInt(order, 10);

        const updated = await prisma.videoCategory.update({
            where: { id },
            data,
        });

        return NextResponse.json({ success: true, category: updated, message: 'Category updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}

// DELETE /api/video-categories/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        if (!(await authAdmin(req))) {
            return NextResponse.json({ message: 'Not allowed' }, { status: 401 });
        }

        const { id } = params;
        await prisma.videoCategory.delete({
            where: { id },
        });

        return NextResponse.json({ success: true, message: 'Category deleted' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
    }
}
