import { NextRequest, NextResponse } from "next/server";
// Platform settings live in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { authPredict } from "@/lib/predict";
// Shared key list — a route.ts file may only export request handlers.
import { PLATFORM_KEYS } from "@/lib/platformKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET is readable by an admin (dashboard) OR the provisioner (x-worker-secret),
// since create.sh needs these values when spinning up a new academy.
function canRead(req: NextRequest): boolean {
    const secret = process.env.WORKER_SECRET;
    if (secret && req.headers.get("x-worker-secret") === secret) return true;
    return authPredict(req);
}

/** GET /api/platform-settings → { settings: { key: value, ... } } (all known keys, "" when unset). */
export async function GET(req: NextRequest) {
    if (!canRead(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const rows = await prisma.platformSetting.findMany();
        const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        const settings = Object.fromEntries(PLATFORM_KEYS.map((k) => [k, stored[k] ?? ""]));
        return NextResponse.json({ settings });
    } catch (err) {
        console.error("[platform-settings] read failed", err);
        return NextResponse.json({ error: "read failed" }, { status: 500 });
    }
}

/** PUT /api/platform-settings  { key: value, ... } → upserts each known key (admin only). */
export async function PUT(req: NextRequest) {
    if (!authPredict(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const body = (await req.json()) as Record<string, unknown>;
        const updates = PLATFORM_KEYS.filter((k) => k in body).map((k) => {
            const value = String(body[k] ?? "");
            return prisma.platformSetting.upsert({
                where: { key: k },
                update: { value },
                create: { key: k, value },
            });
        });
        if (updates.length === 0) {
            return NextResponse.json({ error: "no known keys in body" }, { status: 400 });
        }
        await prisma.$transaction(updates);
        return NextResponse.json({ ok: true, updated: updates.length });
    } catch (err) {
        console.error("[platform-settings] write failed", err);
        return NextResponse.json({ error: "write failed" }, { status: 500 });
    }
}
