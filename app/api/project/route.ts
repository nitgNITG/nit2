import { uploadImage } from "@/utils/firebase";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function POST(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        let data: any = {}
        const body = await req.formData()
        const img = body.get('img');
        const title = body.get('title');
        const description = body.get('description')
        const titleEn = body.get('titleEn');
        const descriptionEn = body.get('descriptionEn')
        const important = body.get('important')
        const type = body.get('type')

        if (!img || !title || !description || !titleEn || !descriptionEn)
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
        const url = await uploadImage(img as File, `${Date.now()}`);
        if (!url)
            return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })
        data = {
            img: url,
            title: title.toString(),
            description: description.toString(),
            titleEn: titleEn.toString(),
            descriptionEn: descriptionEn.toString(),
            type: type
        }
        if (important == "true")
            data.important = true
        const project = await prisma?.project.create({
            data
        })
        return NextResponse.json({ project, message: "Successfully Created" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const query = new URLSearchParams(url.search)
        const type = query.get('type') as string;
        // const limit = query.get('limit') as string;
        const important = query.get('important') as string;
        const lang = query.get('lang') as string;
        let select: any = {
            img: true,
            id: true
        }
        if (lang == "en") {
            select.titleEn = true
            select.descriptionEn = true
        }
        else {
            select.title = true
            select.description = true
        }
        const where: any = {
            type: type ? type : 'project',
        }
        if (important) {
            where.important = true
        }
        const projects = await prisma.project.findMany({
            where,
            select,
            // take: parseInt(limit)
        });
        return NextResponse.json({ data: projects, }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}