import { deleteImage, uploadImage } from "@/utils/cloudinary";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { id } = params;
        const body = await req.formData()
        const data: any = {}
        const img = body.get('img');
        const oldImg = body.get('oldImg')
        const title = body.get('title');
        const description = body.get('description')
        const important = body.get('important')
        const titleEn = body.get('titleEn');
        const descriptionEn = body.get('descriptionEn')
        const typesRaw = body.get('types') as string | null;
        const linksRaw = body.get('links') as string | null;

        if (img && img != 'undefined') {
            await deleteImage(oldImg as string)
            const image = await uploadImage(img as File, 'projects')
            data.img = image
        }
        if (title) data.title = title
        if (description) data.description = description
        if (titleEn) data.titleEn = titleEn
        if (descriptionEn) data.descriptionEn = descriptionEn
        console.log(important);

        if (typesRaw) {
            try {
                const parsed = JSON.parse(typesRaw);
                if (Array.isArray(parsed) && parsed.length > 0) data.types = parsed;
            } catch { /* ignore */ }
        }
        if (linksRaw !== null && linksRaw !== undefined) {
            try { data.links = JSON.parse(linksRaw); } catch { data.links = []; }
        }
        if (important == "true") {
            data.important = true
        } else {
            data.important = false
        }
        const project = await prisma.project.update({
            where: { id: id },
            data
        })
        return NextResponse.json({ project, message: "Successfully updated" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { id } = params;
        const project = await prisma.project.delete({ where: { id } });
        await deleteImage(project.img as string)
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}