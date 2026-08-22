import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authAdmin } from "@/lib/predict";

export async function PUT(req: NextRequest, { params }: { params: { planId: string } }) {
    try {
        if (!(await authAdmin(req))) return NextResponse.json({ message: "Not allowed" }, { status: 401 });
        const body = await req.json();
        const { service, nameAr, nameEn, price, currency, featuresAr, featuresEn, isActive, order } = body;

        const plan = await prisma.servicePlan.update({
            where: { id: params.planId },
            data: {
                ...(service !== undefined && { service }),
                ...(nameAr !== undefined && { nameAr }),
                ...(nameEn !== undefined && { nameEn }),
                ...(price !== undefined && { price: Number(price) }),
                ...(currency !== undefined && { currency }),
                ...(featuresAr !== undefined && { featuresAr }),
                ...(featuresEn !== undefined && { featuresEn }),
                ...(isActive !== undefined && { isActive }),
                ...(order !== undefined && { order: Number(order) }),
            },
        });
        return NextResponse.json({ plan, message: "Updated" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { planId: string } }) {
    try {
        if (!(await authAdmin(req))) return NextResponse.json({ message: "Not allowed" }, { status: 401 });
        await prisma.servicePlan.delete({ where: { id: params.planId } });
        return NextResponse.json({ message: "Deleted" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
