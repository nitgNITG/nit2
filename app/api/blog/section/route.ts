import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const body = await req.json();
        const { title, content, list, articleId } = body;
        const section = await prisma.section.create({
            data: { title, content, list, articleId }
        })
        return NextResponse.json({ section, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const query = new URLSearchParams(url.search);
        const articleId = query.get('articleId');
        if (!articleId)
            return NextResponse.json({ message: 'There is error in articleid' })
        const sections = await prisma.section.findMany({
            where: {
                articleId
            },
            select: {
                id: true,
                list: true,
                title: true,
                content: true
            }
        })
        return NextResponse.json({ sections, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}