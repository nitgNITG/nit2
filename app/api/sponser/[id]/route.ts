import { deleteImage, uploadImage } from "@/utils/firebase";
import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { id } = params;
        const sponser = await prisma.sponser.delete({ where: { id } });
        await deleteImage(sponser.img as string)
        return NextResponse.json({ message: "Successfully deleted" }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}