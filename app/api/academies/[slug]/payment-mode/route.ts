import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";
import { triggerApplyIntegrations } from "@/lib/provisionAcademy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NIT-controlled Kashier payment mode for ONE academy's student payments.
// GET  → { mode: "live" | "test" | "default" }  (default = inherit the platform mode)
// PUT  { mode } → store it and push payment_mode to the academy's Moodle.
// Admin only.

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const academy = await prisma.academy.findUnique({ where: { slug: params.slug }, select: { paymentMode: true } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ mode: academy.paymentMode ?? "default" });
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const mode = String((await req.json().catch(() => ({})))?.mode);
    if (mode !== "live" && mode !== "test" && mode !== "default") {
        return NextResponse.json({ error: "mode must be live, test or default" }, { status: 400 });
    }

    const academy = await prisma.academy.findUnique({ where: { slug: params.slug }, select: { tier: true } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });

    try {
        await prisma.academy.update({
            where: { slug: params.slug },
            data: { paymentMode: mode === "default" ? null : mode },
        });
    } catch (e) {
        console.error("[payment-mode] persist failed", params.slug, e);
        return NextResponse.json({ error: "save failed" }, { status: 500 });
    }

    // Push to the academy's Moodle (best-effort). Rebuild env from its own licence so
    // Kashier on/off stays correct; add the payment_mode override.
    const lic = await prisma.license.findUnique({
        where: { key: academy.tier },
        select: { videoSource: true, kashierEnabled: true },
    });
    await triggerApplyIntegrations(
        params.slug,
        { videoSource: lic?.videoSource ?? "all", kashierEnabled: !!lic?.kashierEnabled },
        { paymentMode: mode as "live" | "test" | "default" },
    );

    return NextResponse.json({ ok: true, mode });
}
