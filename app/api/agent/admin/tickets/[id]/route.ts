// E14 — PATCH /api/agent/admin/tickets/[id] { status } (admin or support).
import { z } from "zod";
import prisma from "@/prisma/client";
import { apiError, OBJECT_ID } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({ status: z.enum(["open", "in_progress", "resolved"]) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const g = await guard("tickets");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "status: open, in_progress or resolved.");
    if (!OBJECT_ID.test(params.id) || !(await prisma.ticket.findUnique({ where: { id: params.id } }))) return apiError(404, "not_found", "Ticket not found.");
    const ticket = await prisma.ticket.update({ where: { id: params.id }, data: { status: parsed.data.status } });
    return Response.json({ ticket });
}
