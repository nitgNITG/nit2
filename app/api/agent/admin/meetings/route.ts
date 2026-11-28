// E21 — GET /api/agent/admin/meetings?status= (admin or sales). FR-S16.
import prisma from "@/prisma/client";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["requested", "confirmed", "done", "cancelled"];

export async function GET(req: Request) {
    const g = await guard("meetings");
    if (g.res) return g.res;
    const status = new URL(req.url).searchParams.get("status");
    if (status && !STATUSES.includes(status)) return apiError(400, "invalid_query", "Unknown status.");
    const rows = await prisma.meetingRequest.findMany({ where: status ? { status } : {}, orderBy: { preferredAt: "asc" }, take: 200 });
    const ids = rows.map((r) => r.contactId).filter((x): x is string => !!x);
    const contacts = ids.length
        ? await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, email: true, tier: true } })
        : [];
    return Response.json({ items: rows.map((r) => ({ ...r, contact: contacts.find((c) => c.id === r.contactId) ?? null })) });
}
