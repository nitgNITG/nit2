import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Control-plane anti-abuse knobs (admin panel). Stored in PlatformSetting; each
// overrides its legacy env fallback once saved. NOT part of the app-binary globals
// pushed to academies — these only gate the self-serve create flow.
const REQUIRE_VERIFY = "require_email_verification"; // "1" = on, "" = off
const DAILY_IP_LIMIT = "academies_daily_ip_limit";   // integer, 0 = disabled

export async function GET() {
    const rows = await prisma.platformSetting.findMany({
        where: { key: { in: [REQUIRE_VERIFY, DAILY_IP_LIMIT] } },
    });
    const map = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));
    // Reflect the effective default when a row is unset: verification defaults off
    // (env may still enable it); the daily cap defaults to 5.
    const rv = map.get(REQUIRE_VERIFY);
    const dl = map.get(DAILY_IP_LIMIT);
    return NextResponse.json({
        requireEmailVerification: rv != null
            ? ["1", "true", "on", "yes"].includes(rv.toLowerCase())
            : process.env.REQUIRE_EMAIL_VERIFICATION === "1",
        dailyIpLimit: dl != null && dl !== "" ? parseInt(dl, 10) : 5,
    });
}

export async function PUT(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    try {
        const body = await req.json();
        const updates = [];

        if ("requireEmailVerification" in body) {
            const value = body.requireEmailVerification ? "1" : "0";
            updates.push(prisma.platformSetting.upsert({
                where: { key: REQUIRE_VERIFY }, update: { value }, create: { key: REQUIRE_VERIFY, value },
            }));
        }
        if ("dailyIpLimit" in body) {
            const n = Math.trunc(Number(body.dailyIpLimit));
            if (!Number.isFinite(n) || n < 0) {
                return NextResponse.json({ error: "invalid daily limit (0 = off, or a positive number)" }, { status: 400 });
            }
            const value = String(n);
            updates.push(prisma.platformSetting.upsert({
                where: { key: DAILY_IP_LIMIT }, update: { value }, create: { key: DAILY_IP_LIMIT, value },
            }));
        }
        if (updates.length === 0) {
            return NextResponse.json({ error: "no known keys in body" }, { status: 400 });
        }
        await prisma.$transaction(updates);
        return NextResponse.json({ ok: true, updated: updates.length });
    } catch {
        return NextResponse.json({ error: "save failed" }, { status: 500 });
    }
}
