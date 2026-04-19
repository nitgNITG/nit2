import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function PUT(req: NextRequest, { params }: { params: { sectionId: string } }) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const body = await req.json();
        const { sectionId } = params;
        const { title, content, list, articleId } = body;
        const section = await prisma.section.update({
            where: { id: sectionId },
            data: { title, content, list, articleId }
        })
        return NextResponse.json({ section, message: "Successfully updated" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest, { params }: { params: { sectionId: string } }) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { sectionId } = params;
        await prisma.section.delete({ where: { id: sectionId } });
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}