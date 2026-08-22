import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict) return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const body = await req.json();
        const { title, titleEn, content, contentEn, list, articleId } = body;
        const section = await prisma.section.create({
            data: { title, titleEn: titleEn || null, content: content || null, contentEn: contentEn || null, list: list || [], articleId }
        })
        return NextResponse.json({ section, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const articleId = searchParams.get('articleId')
        if (!articleId) return NextResponse.json({ message: 'articleId required' }, { status: 400 })
        const sections = await prisma.section.findMany({
            where: { articleId },
            select: { id: true, title: true, titleEn: true, content: true, contentEn: true, list: true }
        })
        return NextResponse.json({ sections }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
