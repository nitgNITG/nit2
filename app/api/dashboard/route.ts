import { NextRequest, NextResponse } from "next/server";
import prisma from '@/prisma/client'
import { authAdmin } from "@/lib/predict";

export async function GET(req: NextRequest) {
    try {
        const isPredict = await authAdmin(req)
        if (!isPredict)
            return NextResponse.json({ message: 'Not allow' }, { status: 400 })
        const [projects, apps, sponsers, articles, contacts] = await prisma.$transaction([
            prisma.project.count({ where: { types: { has: 'lms' } } }),
            prisma.project.count({ where: { types: { has: 'ecommerce' } } }),
            prisma.sponser.count(),
            prisma.article.count(),
            prisma.contact.count(),
        ])
        return NextResponse.json({
            data: [
                {
                    name: 'Projects',
                    value: projects,
                    link: '/dashboard/projects',
                },
                {
                    name: 'Applications',
                    value: apps,
                    link: '/dashboard/application',
                },
                {
                    name: 'Sponser',
                    value: sponsers,
                    link: '/dashboard/sponsers',
                },
                {
                    name: 'Contacts',
                    value: contacts,
                    link: '/dashboard/contacts',
                },
                {
                    name: 'Articles',
                    value: articles,
                    link: '/dashboard/blog',
                },
            ]
        }, { status: 200 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message, message: "There is error in server!!" }, { status: 400 })
    }
}