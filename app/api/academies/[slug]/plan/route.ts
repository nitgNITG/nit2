import { NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/academies/<slug>/plan
//
// One consolidated "My plan & billing" view for an academy, for its OWNER or an
// admin. Bundles what the mobile/dashboard screen needs so it needn't stitch
// /api/licenses + /api/subscriptions + /api/payments itself:
//   - academy:      slug, name, tier, status, subscription term
//   - package:      the licence this academy runs on — its RESOURCES (course/
//                   teacher caps, storage, video source, features) + pricing
//   - subscription: auto-renew term + saved card (null if none / feature off)
//   - payments:     this academy's recent payments (newest first)
//
// Owner sees only their own academy; admin sees any.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const academy = await prisma.academy.findUnique({ where: { slug: params.slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && academy.ownerId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // The package (licence) the academy runs on — its resources + pricing.
    const lic = await prisma.license.findUnique({ where: { key: academy.tier } });

    // Auto-renew subscription for this academy (one per academy), + saved card.
    const sub = await prisma.subscription.findUnique({ where: { academySlug: params.slug } }).catch(() => null);
    let card: { brand: string | null; last4: string | null } | null = null;
    if (sub) {
        const pm = sub.paymentMethodId
            ? await prisma.paymentMethod.findUnique({ where: { id: sub.paymentMethodId } }).catch(() => null)
            : await prisma.paymentMethod.findFirst({ where: { userId: sub.userId, isDefault: true } }).catch(() => null);
        if (pm) card = { brand: pm.brand, last4: pm.last4 };
    }

    // This academy's recent payments (newest first).
    const payments = await prisma.payment.findMany({
        where: { academySlug: params.slug },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
            orderId: true, licenseKey: true, purpose: true, amount: true, currency: true,
            status: true, billingCycle: true, providerRef: true, failureReason: true,
            createdAt: true, paidAt: true,
        },
    }).catch(() => []);

    return NextResponse.json({
        academy: {
            slug: academy.slug,
            name: academy.name,
            status: academy.status,
            tier: academy.tier,
            subscribedAt: academy.subscribedAt,
            validUntil: academy.validUntil, // null = never expires
        },
        // The licence = the package's RESOURCES. Public product data; safe for the owner.
        package: lic ? {
            key: lic.key,
            name: lic.name,
            price: lic.price,
            priceEgp: lic.priceEgp,
            durationDays: lic.durationDays,
            maxCourses: lic.maxCourses,
            maxTeachers: lic.maxTeachers,
            storageGb: lic.storageGb,
            videoSource: lic.videoSource,
            supportedApp: lic.supportedApp,
            kashierEnabled: lic.kashierEnabled,
            limits: lic.limits,
            features: lic.features,
        } : null,
        subscription: sub ? {
            status: sub.status,
            autoRenew: sub.autoRenew,
            licenseKey: sub.licenseKey,
            amountEgp: sub.amountEgp,
            currency: sub.currency,
            intervalDays: sub.intervalDays,
            currentPeriodEnd: sub.currentPeriodEnd,
            nextAttemptAt: sub.nextAttemptAt,
            lastError: sub.lastError,
            card,
        } : null,
        payments,
    });
}
