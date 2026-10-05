// E19 — GET /api/agent/admin/price-ranges (admin or sales). FR-S12.
import prisma from "@/prisma/client";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const g = await guard("price_ranges");
    if (g.res) return g.res;
    const items = await prisma.customPriceRange.findMany({ orderBy: { category: "asc" } });
    return Response.json({ items });
}
