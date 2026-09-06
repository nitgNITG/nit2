import { NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/public-settings — the few NON-sensitive platform values a normal
// (non-admin) user needs client-side, e.g. the academy OWNER using the build form
// on the account page. Never expose secrets or the full settings map here — this
// is readable by any authenticated user, unlike /api/platform-settings (admin).
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let maxImageMb = 1.5;
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key: "max_image_mb" } });
        const n = parseFloat(row?.value ?? "");
        if (Number.isFinite(n) && n > 0) maxImageMb = n;
    } catch {
        // fall back to the default
    }
    return NextResponse.json({ maxImageMb });
}
