// E14 — GET /api/agent/admin/tickets?status= (admin or support). FR-P7.
import prisma from "@/prisma/client";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;

export async function GET(req: Request) {
    const g = await guard("tickets");
    if (g.res) return g.res;
    const status = new URL(req.url).searchParams.get("status");
    if (status && !(TICKET_STATUSES as readonly string[]).includes(status)) return apiError(400, "invalid_query", "Unknown status.");
    const items = await prisma.ticket.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 });
    return Response.json({ items });
}
