import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "prismamysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payments — payment history.
//   admin → every payment (with owner + academy names);
//   client → only their own.
// Filters: ?status=&purpose=&slug=  ·  Paging: ?page=1&limit=20
export async function GET(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const isAdmin = user.role === "admin";

    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") || undefined;
    const purpose = sp.get("purpose") || undefined;
    const slug = sp.get("slug") || undefined;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));

    const where: Prisma.PaymentWhereInput = {
        ...(isAdmin ? {} : { userId: user.id }),
        ...(status ? { status } : {}),
        ...(purpose ? { purpose } : {}),
        ...(slug ? { academySlug: slug } : {}),
    };

    try {
        const [total, payments] = await Promise.all([
            prisma.payment.count({ where }),
            prisma.payment.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    orderId: true, userId: true, licenseKey: true, purpose: true, amount: true,
                    currency: true, status: true, academySlug: true, providerRef: true,
                    failureReason: true, billingCycle: true, subscriptionId: true,
                    createdAt: true, paidAt: true,
                },
            }),
        ]);

        // Attach academy names, and (admin only) the owner name/email.
        const slugs = Array.from(new Set(payments.map((p) => p.academySlug).filter(Boolean) as string[]));
        const academies = slugs.length
            ? await prisma.academy.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } })
            : [];
        const nameBySlug = new Map(academies.map((a) => [a.slug, a.name]));

        let ownerById = new Map<string, { name: string | null; email: string }>();
        if (isAdmin) {
            const ids = Array.from(new Set(payments.map((p) => p.userId).filter(Boolean)));
            const owners = ids.length
                ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
                : [];
            ownerById = new Map(owners.map((u) => [u.id, { name: u.name, email: u.email }]));
        }

        const rows = payments.map((p) => ({
            ...p,
            academyName: p.academySlug ? nameBySlug.get(p.academySlug) ?? null : null,
            owner: isAdmin ? ownerById.get(p.userId) ?? null : undefined,
            kind: p.subscriptionId ? "auto-renew" : "manual",
        }));

        return NextResponse.json({ payments: rows, total, page, limit, isAdmin });
    } catch (e) {
        console.error("[payments] list failed", e);
        return NextResponse.json({ payments: [], total: 0, page, limit, error: "list failed" }, { status: 200 });
    }
}
