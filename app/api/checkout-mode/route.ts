import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";
import { checkoutMode, checkoutConfigured } from "@/lib/kashier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "checkout_mode";

// GET /api/checkout-mode → { mode, configured: { live, test } }
// The live/test toggle for NIT's OWN licence checkout (control plane), plus whether
// each mode's credentials are present in the env. Admin only.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ mode: await checkoutMode(), configured: await checkoutConfigured() });
}

// PUT /api/checkout-mode { mode: "live" | "test" }
export async function PUT(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const mode = String((await req.json().catch(() => ({})))?.mode);
    if (mode !== "live" && mode !== "test") {
        return NextResponse.json({ error: "mode must be live or test" }, { status: 400 });
    }
    try {
        await prisma.platformSetting.upsert({
            where: { key: KEY }, update: { value: mode }, create: { key: KEY, value: mode },
        });
        return NextResponse.json({ ok: true, mode });
    } catch (e) {
        console.error("[checkout-mode] save failed", e);
        return NextResponse.json({ error: "save failed" }, { status: 500 });
    }
}
