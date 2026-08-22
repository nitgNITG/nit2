import { uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";
import { slugify } from "@/utils/slugify";

/** Generate a slug that doesn't already exist in the DB */
async function uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let counter = 1;
    while (await prisma.article.findUnique({ where: { slug } })) {
        slug = `${base}-${++counter}`;
    }
    return slug;
}

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict) return NextResponse.json({ message: 'Not allow' }, { status: 400 })

        const body = await req.formData()
        const img = body.get('img');
        const title = body.get('title') as string | null;
        const content = body.get('content') as string | null;
        const metaDesc = body.get('metaDesc') as string | null;
        const titleEn = body.get('titleEn') as string | null;
        const contentEn = body.get('contentEn') as string | null;
        const metaDescEn = body.get('metaDescEn') as string | null;

        if (!img || !title || !content)
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })

        const url = await uploadImage(img as File, 'articles');
        if (!url) return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })

        const slug = await uniqueSlug(title);

        const article = await prisma.article.create({
            data: {
                slug,
                img: url,
                title,
                content,
                metaDesc: metaDesc || content.slice(0, 155),
                titleEn: titleEn || null,
                contentEn: contentEn || null,
                metaDescEn: metaDescEn || null,
            }
        })
        return NextResponse.json({ article, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

export async function GET() {
    try {
        const articles = await prisma.article.findMany({
            orderBy: { publishedAt: 'desc' },
            select: {
                id: true,
                slug: true,
                img: true,
                title: true,
                titleEn: true,
                content: true,
                contentEn: true,
                publishedAt: true,
            }
        })
        return NextResponse.json({ articles }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
