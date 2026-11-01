import { deleteImage, uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";
import { slugify } from "@/utils/slugify";
import { isScheduled, parsePublishedAt, SECTION_ORDER } from "@/lib/blog";
import { revalidateBlog } from "@/lib/blogRevalidate";

const ARTICLE_FIELDS = {
    id: true,
    slug: true,
    title: true,
    titleEn: true,
    content: true,
    contentEn: true,
    metaDesc: true,
    metaDescEn: true,
    img: true,
    publishedAt: true,
}

export async function GET(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const { aricleId } = params;
        const article = await prisma.article.findFirst({ where: { id: aricleId }, select: ARTICLE_FIELDS })
        if (!article || (isScheduled(article.publishedAt) && !(await authAdmin(req))))
            return NextResponse.json({ message: 'Article not found' }, { status: 404 })
        const sections = await prisma.section.findMany({
            where: { articleId: aricleId },
            orderBy: SECTION_ORDER,
            select: { id: true, title: true, titleEn: true, content: true, contentEn: true, list: true, order: true },
        })
        return NextResponse.json({ article: { ...article, Section: sections } }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

// Text fields the dashboard may change. Required ones can't be cleared; optional ones clear to null.
const REQUIRED = ['title', 'content'] as const
const OPTIONAL = ['titleEn', 'contentEn', 'metaDesc', 'metaDescEn'] as const

export async function PUT(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 401 })
        const { aricleId } = params;
        const current = await prisma.article.findFirst({ where: { id: aricleId }, select: { id: true, slug: true, img: true } })
        if (!current) return NextResponse.json({ message: 'Article not found' }, { status: 404 })

        const body = await req.formData()
        const data: Record<string, unknown> = {}

        for (const key of REQUIRED) {
            const v = body.get(key)
            if (v === null) continue
            if (typeof v !== 'string' || !v.trim())
                return NextResponse.json({ message: `${key} is required` }, { status: 400 })
            data[key] = v.trim()
        }
        for (const key of OPTIONAL) {
            const v = body.get(key)
            if (v === null) continue
            data[key] = typeof v === 'string' && v.trim() ? v.trim() : null
        }

        const publishedAt = parsePublishedAt(body.get('publishedAt'))
        if (publishedAt === null) return NextResponse.json({ message: 'Invalid publish date' }, { status: 400 })
        if (publishedAt) data.publishedAt = publishedAt

        const rawSlug = body.get('slug')
        if (typeof rawSlug === 'string' && rawSlug.trim()) {
            const slug = slugify(rawSlug)
            if (!slug) return NextResponse.json({ message: 'Invalid slug' }, { status: 400 })
            if (slug !== current.slug) {
                const clash = await prisma.article.findFirst({ where: { slug, NOT: { id: aricleId } }, select: { id: true } })
                if (clash) return NextResponse.json({ message: 'Another article already uses this URL' }, { status: 409 })
            }
            data.slug = slug
        }

        const img = body.get('img');
        if (img && img != 'undefined' && typeof img !== 'string') {
            const image = await uploadImage(img as File, 'articles')
            if (!image) return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })
            await deleteImage(current.img)
            data.img = image
        }

        const article = await prisma.article.update({
            where: { id: aricleId },
            data,
            select: ARTICLE_FIELDS,
        })
        revalidateBlog(current.slug, article.slug)
        return NextResponse.json({ article, message: "Successfully updated" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 401 })
        const { aricleId } = params;
        const article = await prisma.article.delete({ where: { id: aricleId } });
        await deleteImage(article.img as string)
        revalidateBlog(article.slug)
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
