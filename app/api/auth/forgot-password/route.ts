import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { validateEmail } from "@/utils/validateEmail";
import { createAndSendOtp } from "@/lib/emailOtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/forgot-password  { email, locale? }
// Emails a 6-digit reset code if the account exists. Always returns 200 with a
// generic message (never reveals whether an email is registered).
export async function POST(req: NextRequest) {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ message: "bad json" }, { status: 400 }); }
    const email = String(body?.email || "").trim().toLowerCase();
    const locale = body?.locale === "en" ? "en" : "ar";
    if (!validateEmail(email)) {
        return NextResponse.json({ message: "البريد الإلكتروني غير صحيح." }, { status: 400 });
    }

    const generic = locale === "en"
        ? "If that email is registered, a reset code is on its way."
        : "لو البريد مسجّل، هيوصلك رمز إعادة التعيين.";

    const user = await prisma.user.findFirst({ where: { email } }).catch(() => null);
    if (user) {
        // Best-effort — swallow cooldown / mailer errors so we don't leak existence.
        await createAndSendOtp(email, "reset", { name: user.name ?? "", locale }).catch(() => {});
    }
    return NextResponse.json({ ok: true, message: generic });
}
