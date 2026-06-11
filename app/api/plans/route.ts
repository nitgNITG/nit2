import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { authPredict } from "@/lib/predict";

// Public: GET all active plans (optionally filtered by service)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const service = searchParams.get("service") || undefined;

        const plans = await prisma.servicePlan.findMany({
            where: {
                isActive: true,
                ...(service ? { service } : {}),
            },
            orderBy: [{ service: "asc" }, { order: "asc" }],
        });
        return NextResponse.json({ plans }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Admin: Create a new plan
export async function POST(req: NextRequest) {
    try {
        if (!authPredict(req)) return NextResponse.json({ message: "Not allowed" }, { status: 401 });
        const body = await req.json();
        const { service, nameAr, nameEn, price, currency, featuresAr, featuresEn, isActive, order } = body;
        if (!service || !nameAr || !nameEn || price === undefined)
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });

        const plan = await prisma.servicePlan.create({
            data: {
                service,
                nameAr,
                nameEn,
                price: Number(price),
                currency: currency || "USD",
                featuresAr: featuresAr || [],
                featuresEn: featuresEn || [],
                isActive: isActive !== false,
                order: Number(order) || 0,
            },
        });
        return NextResponse.json({ plan, message: "Plan created" }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
