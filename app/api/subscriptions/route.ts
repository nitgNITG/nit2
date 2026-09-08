import { NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { subscriptionsEnabled } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/subscriptions — auto-renew subscriptions for the signed-in user (admins
// get all). Each includes the saved card's brand/last4 (never the token). Returns
// an empty list while the feature is off.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!subscriptionsEnabled()) return NextResponse.json({ subscriptions: [], enabled: false });

    const isAdmin = user.role === "admin";
    const subs = await prisma.subscription
        .findMany({
            where: isAdmin ? undefined : { userId: user.id },
            orderBy: { currentPeriodEnd: "asc" },
        })
        .catch((e) => { console.error("[subscriptions] list failed", e); return []; });

    // Attach the saved card (by explicit paymentMethodId, else the owner's default).
    const pmIds = subs.map((s) => s.paymentMethodId).filter(Boolean) as string[];
    const userIds = Array.from(new Set(subs.map((s) => s.userId)));
    const [pmsById, defaults] = await Promise.all([
        pmIds.length
            ? prisma.paymentMethod.findMany({ where: { id: { in: pmIds } } })
            : Promise.resolve([]),
        prisma.paymentMethod.findMany({ where: { userId: { in: userIds }, isDefault: true } }),
    ]);
    const byId = new Map(pmsById.map((p) => [p.id, p]));
    const defByUser = new Map(defaults.map((p) => [p.userId, p]));

    // Billing history — the last few renewal/update charges per academy.
    const slugs = subs.map((s) => s.academySlug);
    const history = slugs.length
        ? await prisma.payment.findMany({
              where: { academySlug: { in: slugs }, purpose: { in: ["renew", "update_card"] } },
              orderBy: { createdAt: "desc" },
              select: { academySlug: true, amount: true, currency: true, status: true, purpose: true, createdAt: true, paidAt: true },
          }).catch(() => [])
        : [];
    const histBySlug = new Map<string, typeof history>();
    for (const h of history) {
        const arr = histBySlug.get(h.academySlug!) ?? [];
        if (arr.length < 6) { arr.push(h); histBySlug.set(h.academySlug!, arr); }
    }

    const subscriptions = subs.map((s) => {
        const pm = (s.paymentMethodId && byId.get(s.paymentMethodId)) || defByUser.get(s.userId) || null;
        return {
            academySlug: s.academySlug, userId: s.userId, status: s.status, autoRenew: s.autoRenew,
            licenseKey: s.licenseKey, amountEgp: s.amountEgp, currency: s.currency,
            intervalDays: s.intervalDays, currentPeriodEnd: s.currentPeriodEnd,
            nextAttemptAt: s.nextAttemptAt, lastError: s.lastError,
            card: pm ? { brand: pm.brand, last4: pm.last4 } : null,
            payments: (histBySlug.get(s.academySlug) ?? []).map((h) => ({
                amount: h.amount, currency: h.currency, status: h.status, purpose: h.purpose,
                date: (h.paidAt ?? h.createdAt),
            })),
        };
    });
    return NextResponse.json({ subscriptions, enabled: true });
}
