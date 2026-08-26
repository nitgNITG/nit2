import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/academies/update-images   { slug? }
// Recreate live academies onto the current baked image (SAAS_IMAGE) — the baked
// equivalent of "pull latest code". Preserves each academy's db + moodledata.
// With `slug` → just that one; otherwise every live academy. Admin only.
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) {
        return NextResponse.json({ error: "provisioning not configured (PROVISION_URL/SECRET)" }, { status: 400 });
    }

    let one: string | undefined;
    try { one = (await req.json())?.slug; } catch { /* no body → all */ }

    try {
        const academies = one
            ? await prisma.academy.findMany({ where: { slug: one }, select: { slug: true } })
            : await prisma.academy.findMany({ where: { status: "live" }, select: { slug: true } });

        // Recreate each container onto the current image — best-effort, in parallel.
        const results = await Promise.allSettled(
            academies.map((a) => {
                const url = new URL(base);
                url.pathname = `/update-image/${a.slug}`;
                return fetch(url.toString(), {
                    method: "POST",
                    headers: { "X-Provision-Secret": secret, "Content-Type": "application/json" },
                });
            }),
        );
        const queued = results.filter((r) => r.status === "fulfilled").length;
        return NextResponse.json({ ok: true, academies: academies.length, queued });
    } catch (err) {
        console.error("[academies/update-images] failed", err);
        return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
}
