// E21 — PATCH /api/agent/admin/meetings/[id] { status } (admin or sales).
import { z } from "zod";
import prisma from "@/prisma/client";
import { apiError, OBJECT_ID } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ status: z.enum(["confirmed", "done", "cancelled"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const g = await guard("meetings");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "status: confirmed, done or cancelled.");
    if (!OBJECT_ID.test(params.id) || !(await prisma.meetingRequest.findUnique({ where: { id: params.id } }))) return apiError(404, "not_found", "Meeting not found.");
    const meeting = await prisma.meetingRequest.update({ where: { id: params.id }, data: { status: parsed.data.status } });
    return Response.json({ meeting });
}
