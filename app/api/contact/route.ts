import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authPredict } from "@/lib/predict";


export async function POST(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const { name, email, subject, message } = await req.json()
        if (!name || !email || !subject || !message) {
            return NextResponse.json({ message: "يرجي ادخال جميع البيانات" }, { status: 400 })
        } else {
            await prisma.contact.create({
                data: {
                    name,
                    email,
                    subject,
                    message
                }
            })
            return NextResponse.json({ message: "تم الارسال بنجاح" }, { status: 201 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function GET(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const url = new URL(req.url);
        const query = new URLSearchParams(url.search);
        const skip = query.get('skip') || "0"
        const isRead = query.get('isRead')
        if (isRead) {
            const count = await prisma.contact.count({
                where: {
                    isReaded: false
                },

            })
            return NextResponse.json({ count }, { status: 200 })
        } else {
            const contacts = await prisma.contact.findMany({
                skip: parseInt(skip as string),
                take: 17,
                orderBy: {
                    createdAt: 'asc'
                }
            })
            return NextResponse.json({ contacts }, { status: 200 })
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}
export async function PUT(req: NextRequest) {
    try {
        const isPredict = await authPredict(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        await prisma.contact.updateMany({
            data: {
                isReaded: true
            }
        })
        return NextResponse.json({ message: 'successfully upated!!' }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}