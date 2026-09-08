import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

// Lets client components (the navbar) know who's signed in — the token cookie is
// httpOnly, so the browser can't read it directly.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
}

// PATCH /api/me — the signed-in user updates their own profile: display name and/or
// password. Changing the password requires the current one. Email is not editable
// here (it's the login identity — support changes it).
export async function PATCH(req: NextRequest) {
    const session = await getCurrentUser();
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const data: { name?: string; password?: string } = {};

    // Name
    if (body?.name !== undefined) {
        const name = String(body.name).trim();
        if (name.length < 2) return NextResponse.json({ error: "الاسم قصير جدًا." }, { status: 400 });
        if (name.length > 80) return NextResponse.json({ error: "الاسم طويل جدًا." }, { status: 400 });
        data.name = name;
    }

    // Password change — needs the current password.
    if (body?.newPassword !== undefined && String(body.newPassword) !== "") {
        const newPassword = String(body.newPassword);
        const currentPassword = String(body?.currentPassword ?? "");
        if (newPassword.length < 8) {
            return NextResponse.json({ error: "كلمة المرور الجديدة قصيرة (8 أحرف على الأقل)." }, { status: 400 });
        }
        const row = await prisma.user.findUnique({ where: { id: session.id }, select: { password: true } });
        if (!row) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        const ok = await bcrypt.compare(currentPassword, row.password).catch(() => false);
        if (!ok) return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة." }, { status: 400 });
        data.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "لا يوجد تغيير." }, { status: 400 });
    }

    try {
        const updated = await prisma.user.update({
            where: { id: session.id }, data,
            select: { id: true, name: true, email: true, role: true },
        });
        return NextResponse.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
    } catch (e) {
        console.error("[me] update failed", e);
        return NextResponse.json({ error: "تعذّر حفظ التغييرات." }, { status: 500 });
    }
}
