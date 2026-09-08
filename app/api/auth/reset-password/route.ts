import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prismaMysql";
import { validateEmail } from "@/utils/validateEmail";
import { verifyOtp } from "@/lib/emailOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/reset-password  { email, code, password }
// Verifies the 6-digit reset code, then sets the new password.
export async function POST(req: NextRequest) {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ message: "bad json" }, { status: 400 }); }
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    const password = String(body?.password || "");

    if (!validateEmail(email)) return NextResponse.json({ message: "البريد الإلكتروني غير صحيح." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ message: "كلمة السر لازم 8 أحرف على الأقل." }, { status: 400 });

    const v = await verifyOtp(email, "reset", code);
    if (!v.ok) {
        const msg = v.error === "wrong-code" ? "الرمز غير صحيح."
            : v.error === "too-many-attempts" ? "محاولات كتير، اطلب رمز جديد."
            : "الرمز منتهي أو غير موجود، اطلب رمز جديد.";
        return NextResponse.json({ message: msg }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email } }).catch(() => null);
    if (!user) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });

    try {
        const hashed = await bcrypt.hash(password, 10);
        // A confirmed reset also proves control of the inbox → mark verified.
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed, emailVerified: true } });
        return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور." });
    } catch (e) {
        console.error("[reset-password] failed", e);
        return NextResponse.json({ message: "تعذّر حفظ كلمة المرور." }, { status: 500 });
    }
}
