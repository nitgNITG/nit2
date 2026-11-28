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

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

/** page is 0 when the caller didn't ask for paging; bad numbers fall back to sane values. */
function readPaging(params: URLSearchParams) {
    if (!params.has('page')) return { page: 0, pageSize: DEFAULT_PAGE_SIZE }
    const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
    const size = Math.floor(Number(params.get('pageSize'))) || DEFAULT_PAGE_SIZE
    return { page, pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, size)) }
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
// With ?page=N (and optional pageSize, max 50) the list is paginated and the response adds
// total/page/pageSize/pages; without it the whole list comes back as before.
export async function GET(req: NextRequest) {
    try {
        const isAdmin = await authAdmin(req)
        const where = isAdmin ? undefined : publishedWhere()
        const { page, pageSize } = readPaging(new URL(req.url).searchParams)
        const [total, articles] = await Promise.all([
            page ? prisma.article.count({ where }) : Promise.resolve(0),
            prisma.article.findMany({
                where,
                // id breaks publishedAt ties so pages never repeat or skip an article
                orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
                ...(page ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
                select: {
                    id: true,
                    slug: true,
                    img: true,
                    title: true,
                    titleEn: true,
                    content: true,
                    contentEn: true,
                    publishedAt: true,
                },
            }),
        ])
        if (!page) return NextResponse.json({ articles }, { status: 200 })
        return NextResponse.json({ articles, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
