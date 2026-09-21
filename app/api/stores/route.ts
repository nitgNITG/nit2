import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { alertAdmins, supportWhatsapp } from "@/lib/adminAlert";
import { creationBlockedMessage, healthBlockAlertBody } from "@/lib/serverHealth";
import { evaluateStoreHealth, STORE_PRODUCT, storeLiveUrl } from "@/lib/products/store";
import { createStore, sanitizeStoreSettings } from "@/lib/tenants/createStore";
import {
    clientIp, dailyIpLimit, freeQuota, hourlyRateLimit, requireVerifiedEmail,
    resolveLicense, resolveOwner, slugTaken, validateNameSlug,
} from "@/lib/tenants/gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stores — the caller's stores (admin: all). Same shape as /api/academies.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const rows = await prisma.tenant.findMany({
        where: { product: STORE_PRODUCT, ...(user.role === "admin" ? {} : { ownerId: user.id }) },
        orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
        stores: rows.map(({ adminPasswordEnc: _a, nitAdminPasswordEnc: _n, ...t }) => ({ ...t, url: storeLiveUrl(t.slug) })),
    });
}

// POST /api/stores — create a FREE store (or an admin comp on any tier). Paid
// tiers go through POST /api/payments/kashier/create {product:"store"} and are
// created by the webhook. Gates mirror the academy route (handbook §3).
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        if (body?._hp) return NextResponse.json({ ok: true }, { status: 201 }); // honeypot

        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "لازم تسجّل الدخول الأول." }, { status: 401 });
        const locale: "ar" | "en" = body?.locale === "en" ? "en" : "ar";

        const ownerRes = await resolveOwner(user, body);
        if (!ownerRes.ok) return ownerRes.response;
        const { owner, adminComp, createdOwnerPassword } = ownerRes;

        if (!adminComp) {
            const v = await requireVerifiedEmail(user, locale);
            if (v) return v;
        }
        const ip = clientIp(req);
        if (!adminComp) {
            const r = hourlyRateLimit(STORE_PRODUCT, ip);
            if (r) return r;
        }

        const licRes = await resolveLicense(STORE_PRODUCT, String(body?.tier ?? "").trim().toLowerCase(), adminComp);
        if (!licRes.ok) return licRes.response;
        const { lic, rank } = licRes.value;
        // Paid plans are bought through checkout; a comp is the only way to skip it.
        if (!adminComp && (lic.priceEgp > 0 || lic.price > 0)) {
            return NextResponse.json({ error: "هذه الباقة مدفوعة — أكمل الدفع أولاً.", errorcode: "paid_tier" }, { status: 402 });
        }
        if (!adminComp) {
            const q = await freeQuota(STORE_PRODUCT, owner.id, lic);
            if (q) return q;
        }

        const ns = validateNameSlug(body?.name, body?.slug);
        if (!ns.ok) return ns.response;
        const { name, slug } = ns;
        if (await slugTaken(slug)) return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });

        const verdict = await evaluateStoreHealth();
        if (!verdict.ok) {
            await alertAdmins(`🚫 Store creation blocked — ${slug}`, `${healthBlockAlertBody(verdict)}\n\nRequested by: ${user.email ?? user.id} · tier ${lic.key}`);
            return NextResponse.json(
                { error: creationBlockedMessage(), errorcode: "server_unhealthy", reason: verdict.reason, support_whatsapp: await supportWhatsapp() },
                { status: 503 },
            );
        }
        if (!adminComp) {
            const d = await dailyIpLimit(STORE_PRODUCT, ip);
            if (d) return d;
        }

        const result = await createStore({
            slug, name, nameAr: typeof body?.name_ar === "string" ? body.name_ar.trim().slice(0, 150) : null,
            store: sanitizeStoreSettings(body?.store),
            lic, rank, durationDays: lic.durationDays ?? 0,
            owner: { ...owner, locale },
            licenseMode: null,
        });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json(
            { ok: true, slug, url: result.url, job: result.job, ...(createdOwnerPassword ? { ownerPassword: createdOwnerPassword } : {}) },
            { status: 201 },
        );
    } catch (e) {
        console.error("[stores] create failed", e);
        return NextResponse.json({ error: "فشل إنشاء المتجر، حاول تاني." }, { status: 500 });
    }
}
