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
        const url = await uploadImage(img as File, `${Date.now()}`);
        if (!url)
            return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 })
        const sponser = await prisma.sponser.create({
            data: {
                img: url,
            }
        })
        return NextResponse.json({ sponser, message: "Successfully uploaded" }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const sponsers = await prisma.sponser.findMany();
        return NextResponse.json({ sponsers, }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}