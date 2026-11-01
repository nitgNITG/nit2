import { uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";
import { slugify } from "@/utils/slugify";
import { parsePublishedAt, publishedWhere, stripRichText } from "@/lib/blog";
import { revalidateBlog } from "@/lib/blogRevalidate";

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

const optional = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict) return NextResponse.json({ message: 'Not allow' }, { status: 401 })

        const body = await req.formData()
        const img = body.get('img');
        const title = optional(body.get('title'));
        const content = optional(body.get('content'));
        const metaDesc = optional(body.get('metaDesc'));
        const publishedAt = parsePublishedAt(body.get('publishedAt'));

        if (!img || !title || !content)
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
        if (publishedAt === null)
            return NextResponse.json({ message: 'Invalid publish date' }, { status: 400 })

        const url = await uploadImage(img as File, 'articles');
        if (!url) return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })

        const slug = await uniqueSlug(title);

        const article = await prisma.article.create({
            data: {
                slug,
                img: url,
                title,
                content,
                metaDesc: metaDesc || stripRichText(content).slice(0, 155),
                titleEn: optional(body.get('titleEn')),
                contentEn: optional(body.get('contentEn')),
                metaDescEn: optional(body.get('metaDescEn')),
                ...(publishedAt ? { publishedAt } : {}),
            }
        })
        revalidateBlog(article.slug)
        return NextResponse.json({ article, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

// Visitors only get published articles; the dashboard (admin) also sees scheduled ones.
export async function GET(req: NextRequest) {
    try {
        const isAdmin = await authAdmin(req)
        const articles = await prisma.article.findMany({
            where: isAdmin ? undefined : publishedWhere(),
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
