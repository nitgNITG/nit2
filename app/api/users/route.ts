import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/users?q=  — admin: list users for the owner picker (id, name, email).
// Optional case-insensitive search on name/email. Admin only.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const q = (new URL(req.url).searchParams.get("q") || "").trim();
    try {
        const users = await prisma.user.findMany({
            where: q
                ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
                : undefined,
            select: { id: true, name: true, email: true, role: true },
            orderBy: { createdAt: "desc" },
            take: 500,
        });
        return NextResponse.json({ users });
    } catch (e) {
        console.error("[users] list failed", e);
        return NextResponse.json({ users: [], error: "list failed" }, { status: 200 });
    }
}
