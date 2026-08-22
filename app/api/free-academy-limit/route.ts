import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Global control-plane setting: how many FREE academies a single user account may
// create (across all free licences). Stored in PlatformSetting; NOT pushed to any
// academy's Moodle (it isn't in the mobile-settings whitelist).
const KEY = "free_academy_limit";

export async function GET() {
    const row = await prisma.platformSetting.findUnique({ where: { key: KEY } });
    return NextResponse.json({ limit: row ? parseInt(row.value, 10) : 1 });
}

export async function PUT(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    try {
        const n = Math.trunc(Number((await req.json())?.limit));
        if (!Number.isFinite(n) || n < -1) {
            return NextResponse.json({ error: "invalid limit (-1 = unlimited, or 0+)" }, { status: 400 });
        }
        const value = String(n);
        await prisma.platformSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
        return NextResponse.json({ ok: true, limit: n });
    } catch {
        return NextResponse.json({ error: "save failed" }, { status: 500 });
    }
}
