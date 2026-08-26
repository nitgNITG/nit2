import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payments/<orderId> — the owner polls this from the callback page to
// learn whether the webhook has confirmed payment yet.
export async function GET(_req: NextRequest, { params }: { params: { orderId: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const payment = await prisma.payment.findUnique({ where: { orderId: params.orderId } }).catch(() => null);
    if (!payment) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (payment.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    return NextResponse.json({
        status: payment.status, // pending | paid | failed
        purpose: payment.purpose,
        academySlug: payment.academySlug,
        licenseKey: payment.licenseKey,
        amount: payment.amount,
        currency: payment.currency,
    });
}
