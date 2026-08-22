import { deleteImage, uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";

export async function GET(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const { aricleId } = params;
        const article = await prisma.article.findFirst({
            where: { id: aricleId },
            select: {
                id: true,
                title: true,
                content: true,
                img: true,
                Section: {
                    select: {
                        list: true,
                        id: true,
                        title: true,
                        content: true,
                    }
                }
            }
        })
        return NextResponse.json({ article }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

export async function PUT(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { aricleId } = params;
        const body = await req.formData()
        const data: any = {}
        const img = body.get('img');
        const oldImg = body.get('oldImg')
        const title = body.get('title');
        const content = body.get('content')
        const slug = body.get('slug')

        if (img && img != 'undefined') {
            await deleteImage(oldImg as string)
            const image = await uploadImage(img as File, 'articles')
            data.img = image
        }
        if (title) data.title = title
        if (content) data.content = content
        if (slug) data.slug = slug as string
        const article = await prisma.article.update({
            where: { id: aricleId },
            data
        })
        return NextResponse.json({ article, message: "Successfully updated" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function DELETE(req: NextRequest, { params }: { params: { aricleId: string } }) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { aricleId } = params;
        const article = await prisma.article.delete({ where: { id: aricleId } });
        await deleteImage(article.img as string)
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}