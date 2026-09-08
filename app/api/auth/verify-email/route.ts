import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import prisma from "@/lib/prismaMysql";
import { validateEmail } from "@/utils/validateEmail";
import { verifyOtp } from "@/lib/emailOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/verify-email  { email, code }
// Verifies the 6-digit code and marks the account verified. Also signs the user in
// (sets the token cookie) so verifying straight after sign-up lands them logged in.
export async function POST(req: NextRequest) {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ message: "bad json" }, { status: 400 }); }
    const email = String(body?.email || "").trim().toLowerCase();
    const code = String(body?.code || "").trim();
    if (!validateEmail(email)) return NextResponse.json({ message: "البريد الإلكتروني غير صحيح." }, { status: 400 });

    const v = await verifyOtp(email, "verify", code);
    if (!v.ok) {
        const msg = v.error === "wrong-code" ? "الرمز غير صحيح."
            : v.error === "too-many-attempts" ? "محاولات كتير، اطلب رمز جديد."
            : "الرمز منتهي أو غير موجود، اطلب رمز جديد.";
        return NextResponse.json({ message: msg }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email } }).catch(() => null);
    if (!user) return NextResponse.json({ message: "الحساب غير موجود." }, { status: 404 });

    try {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
        // Sign them in.
        const token = jwt.sign({ id: user.id }, process.env.SECRET_JWT as string);
        cookies().set({ name: "token", value: token, httpOnly: true, maxAge: 5454512 });
        return NextResponse.json({ ok: true, message: "تم تأكيد بريدك." });
    } catch (e) {
        console.error("[verify-email] failed", e);
        return NextResponse.json({ message: "تعذّر تأكيد البريد." }, { status: 500 });
    }
}
