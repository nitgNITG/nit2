import { uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const body = await req.formData()
        const img = body.get('img');
        const title = body.get('title');
        const content = body.get('content')
        if (!img || !title || !content)
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
        const url = await uploadImage(img as File, `${Date.now()}`);
        if (!url)
            return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })
        const article = await prisma.article.create({
            data: {
                img: url,
                title: title.toString(),
                content: content.toString(),
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
            select: {
                id: true,
                img: true,
                title: true,
                content: true
            }
        })
        return NextResponse.json({ articles }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}