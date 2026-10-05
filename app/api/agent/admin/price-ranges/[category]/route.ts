// E19 — PUT /api/agent/admin/price-ranges/[category] (admin or sales). FR-S12, AC-28.1.
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { PriceRangeSchema, savePriceRange } from "@/lib/agent/priceRanges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { category: string } }) {
    const g = await guard("price_ranges");
    if (g.res) return g.res;
    if (!/^[a-z0-9_]{1,60}$/.test(params.category)) return apiError(400, "invalid_body", "category: lowercase letters, digits and _ only.");
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = PriceRangeSchema.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Validation failed.");
    const r = await savePriceRange(params.category, parsed.data, g.staff.user.id);
    if (r === "conflict") return apiError(409, "config_version_conflict", "Someone changed this range after you opened it. Reload and try again.");
    return Response.json({ range: r });
}
