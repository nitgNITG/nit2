// E22 — PUT /api/agent/admin/staff/[userId]/permissions { permissions } (admin). FR-C4.
import { z } from "zod";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { AGENT_PERMISSIONS } from "@/lib/agent/security/authorization";
import { setPermissions } from "@/lib/agent/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ permissions: z.array(z.enum(AGENT_PERMISSIONS)).max(3) });

export async function PUT(req: Request, { params }: { params: { userId: string } }) {
    const g = await guard("staff");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "permissions: any of sales, support, viewer.");
    const user = await setPermissions(params.userId, parsed.data.permissions);
    if (!user) return apiError(404, "not_found", "User not found.");
    return Response.json({ user });
}
