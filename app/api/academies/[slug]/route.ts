import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";

export const runtime = "nodejs";

// PATCH /api/academies/<slug>  { status }
// The server polling worker calls this to advance the lifecycle:
//   branch_created -> provisioning -> live | failed
// Guarded by a shared secret (WORKER_SECRET) when set; open in dev if unset.
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
    const secret = process.env.WORKER_SECRET;
    if (secret && req.headers.get("x-worker-secret") !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
        const { status } = await req.json();
        const allowed = ["branch_created", "provisioning", "live", "failed"];
        if (!status || !allowed.includes(status)) {
            return NextResponse.json({ error: "invalid status" }, { status: 400 });
        }
        const academy = await prisma.academy.update({
            where: { slug: params.slug },
            data: { status },
        });
        return NextResponse.json({ ok: true, slug: academy.slug, status: academy.status });
    } catch (err: any) {
        if (err?.code === "P2025") {
            return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        return NextResponse.json({ error: err?.message || "update failed" }, { status: 400 });
    }
}
