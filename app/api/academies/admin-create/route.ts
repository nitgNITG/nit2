import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { authAdmin } from "@/lib/predict";
import { sanitizeBrand } from "@/lib/brand";
import { validateEmail } from "@/utils/validateEmail";
import { provisionAcademy, licenseToDefinition } from "@/lib/provisionAcademy";
import { computeUpgradable } from "@/lib/licenseDefinition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// POST /api/academies/admin-create — an ADMIN provisions an academy FOR a user, on
// ANY tier (including "contact sales" tiers like Professional), with NO payment.
// The owner is resolved by email: an existing user is used as-is, otherwise a new
// user is created (a generated password is returned so the admin can share it).
// Admin only.
export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const name = String(body?.name ?? "").trim();
    const slug = String(body?.slug ?? "").trim().toLowerCase();
    const tier = String(body?.tier ?? "").trim().toLowerCase();
    const ownerEmail = String(body?.ownerEmail ?? "").trim().toLowerCase();
    const ownerName = String(body?.ownerName ?? "").trim();
    const locale = body?.locale === "en" ? "en" : "ar";
    const platformLang = ["ar", "en", "both"].includes(body?.platform_lang) ? body.platform_lang : "both";
    const brand = sanitizeBrand(body?.brand);

    if (!name) return NextResponse.json({ error: "اسم الأكاديمية مطلوب." }, { status: 400 });
    if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "المعرّف: حروف إنجليزية صغيرة وأرقام وشرطات (3–40)." }, { status: 400 });
    if (!validateEmail(ownerEmail)) return NextResponse.json({ error: "بريد المالك غير صحيح." }, { status: 400 });

    // Licence — any ACTIVE tier, including contactSales (admin comp bypasses the
    // self-serve "contact sales" refusal).
    const lic = await prisma.license.findFirst({ where: { key: tier, active: true } });
    if (!lic) return NextResponse.json({ error: "الباقة غير موجودة أو غير مفعّلة." }, { status: 400 });

    // Slug already taken?
    const existingAcademy = await prisma.academy.findUnique({ where: { slug } }).catch(() => null);
    if (existingAcademy) return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل." }, { status: 409 });

    // Resolve or create the owner.
    let owner = await prisma.user.findFirst({ where: { email: ownerEmail } }).catch(() => null);
    let generatedPassword: string | null = null;
    if (!owner) {
        if (ownerName.length < 2) {
            return NextResponse.json({ error: "المالك جديد — اكتب اسمه." }, { status: 400 });
        }
        const provided = String(body?.ownerPassword ?? "");
        const password = provided.length >= 8 ? provided : crypto.randomBytes(9).toString("base64url");
        if (provided.length < 8) generatedPassword = password;
        try {
            owner = await prisma.user.create({
                data: {
                    name: ownerName,
                    email: ownerEmail,
                    password: await bcrypt.hash(password, 10),
                    role: "client",
                    emailVerified: true, // admin-created → trusted, no OTP needed
                },
            });
        } catch (e: any) {
            if (e?.code === "P2002") return NextResponse.json({ error: "البريد ده مسجّل بالفعل." }, { status: 409 });
            console.error("[admin-create] user create failed", e);
            return NextResponse.json({ error: "تعذّر إنشاء المستخدم." }, { status: 500 });
        }
    }

    // Term + definition (same shape the paid webhook builds).
    const durationDays = lic.durationDays ?? 0;
    const rankLics = await prisma.license.findMany({ where: { active: true }, select: { key: true, active: true, order: true, priceEgp: true } }).catch(() => []);
    const definition = licenseToDefinition(lic, {
        validUntil: durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000) : null,
        subscribedAt: new Date(),
        upgradable: computeUpgradable(tier, rankLics),
    });

    const result = await provisionAcademy({
        slug, name, brand, tier, durationDays, definition,
        owner: { id: owner.id, email: owner.email, name: owner.name ?? ownerName, locale },
        platformLang,
        licenseMode: null, // admin comp — not a paid live/test purchase
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status || 502 });
    }
    return NextResponse.json({
        ok: true,
        slug,
        ownerId: owner.id,
        // Present only when we created a NEW user and generated its password.
        ...(generatedPassword ? { ownerPassword: generatedPassword, ownerEmail } : {}),
    });
}
