import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";
import { isScheduled, SECTION_ORDER } from "@/lib/blog";
import { revalidateBlog } from "@/lib/blogRevalidate";
import { toSectionData } from "@/lib/blogSection";

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict) return NextResponse.json({ message: 'Not allow' }, { status: 401 })
        const body = await req.json();
        const article = body.articleId
            ? await prisma.article.findFirst({ where: { id: body.articleId }, select: { id: true, slug: true } })
            : null
        if (!article) return NextResponse.json({ message: 'Article not found' }, { status: 404 })
        const data = toSectionData(body)
        if (!data) return NextResponse.json({ message: 'Section title is required' }, { status: 400 })
        // Without an explicit position a new section goes to the end.
        const order = Number.isInteger(body.order) ? body.order : await prisma.section.count({ where: { articleId: article.id } })
        const section = await prisma.section.create({ data: { ...data, order, articleId: article.id } })
        revalidateBlog(article.slug)
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
        const article = await prisma.article.findFirst({ where: { id: articleId }, select: { publishedAt: true } })
        if (!article || (isScheduled(article.publishedAt) && !(await authAdmin(req))))
            return NextResponse.json({ message: 'Article not found' }, { status: 404 })
        const sections = await prisma.section.findMany({
            where: { articleId },
            orderBy: SECTION_ORDER,
            select: { id: true, title: true, titleEn: true, content: true, contentEn: true, list: true, order: true }
        })
        return NextResponse.json({ sections }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
