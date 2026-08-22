import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { parseLicense, KEY_RE } from "@/lib/licenseShape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/licenses — list all licences (ordered). Product definitions, not secret.
export async function GET() {
    try {
        const licenses = await prisma.license.findMany({ orderBy: [{ order: "asc" }, { price: "asc" }] });
        return NextResponse.json({ licenses });
    } catch (err) {
        console.error("[licenses] list failed", err);
        return NextResponse.json({ licenses: [], error: "list failed" }, { status: 200 });
    }
}

// POST /api/licenses — create a licence (admin).
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    try {
        const body = await req.json();
        const key = String(body?.key ?? "").trim().toLowerCase();
        if (!KEY_RE.test(key)) {
            return NextResponse.json({ error: "invalid key (lowercase letters, digits, hyphens; 3–40)" }, { status: 400 });
        }
        const data = parseLicense(body);
        if (!data.name) return NextResponse.json({ error: "name required" }, { status: 400 });
        const license = await prisma.license.create({ data: { key, ...data } });
        return NextResponse.json({ license, message: "License created" }, { status: 201 });
    } catch (err: any) {
        if (err?.code === "P2002") return NextResponse.json({ error: "a license with that key already exists" }, { status: 409 });
        console.error("[licenses] create failed", err);
        return NextResponse.json({ error: "create failed" }, { status: 500 });
    }
}
