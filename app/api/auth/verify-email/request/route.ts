import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { validateEmail } from "@/utils/validateEmail";
import { createAndSendOtp } from "@/lib/emailOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/verify-email/request  { email, locale? }
// Emails a 6-digit verification code to an UNVERIFIED account. Generic 200.
export async function POST(req: NextRequest) {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ message: "bad json" }, { status: 400 }); }
    const email = String(body?.email || "").trim().toLowerCase();
    const locale = body?.locale === "en" ? "en" : "ar";
    if (!validateEmail(email)) return NextResponse.json({ message: "البريد الإلكتروني غير صحيح." }, { status: 400 });

    const user = await prisma.user.findFirst({ where: { email } }).catch(() => null);
    if (user && !user.emailVerified) {
        await createAndSendOtp(email, "verify", { name: user.name ?? "", locale }).catch(() => {});
    }
    return NextResponse.json({
        ok: true,
        message: locale === "en" ? "If needed, a verification code was sent." : "لو محتاج، اتبعت رمز التأكيد.",
    });
}
