import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";
import { revalidateBlog } from "@/lib/blogRevalidate";
import { toSectionData } from "@/lib/blogSection";

async function articleSlug(articleId: string) {
    const article = await prisma.article.findFirst({ where: { id: articleId }, select: { slug: true } })
    return article?.slug
}

export async function PUT(req: NextRequest, { params }: { params: { sectionId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 401 })
        const body = await req.json();
        const { sectionId } = params;
        const data = toSectionData(body)
        if (!data) return NextResponse.json({ message: 'Section title is required' }, { status: 400 })
        const section = await prisma.section.update({
            where: { id: sectionId },
            data: { ...data, ...(Number.isInteger(body.order) ? { order: body.order } : {}) }
        })
        revalidateBlog(await articleSlug(section.articleId))
        return NextResponse.json({ section, message: "Successfully updated" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest, { params }: { params: { sectionId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 401 })
        const { sectionId } = params;
        const section = await prisma.section.delete({ where: { id: sectionId } });
        revalidateBlog(await articleSlug(section.articleId))
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
