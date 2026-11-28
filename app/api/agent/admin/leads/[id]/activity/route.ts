// GET /api/agent/admin/leads/[id]/activity (admin or sales) — the lead's CRM
// timeline of AI conversation events (FR-I4, §13.12), newest first.
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { apiError, OBJECT_ID } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const g = await guard("leads");
    if (g.res) return g.res;
    if (!OBJECT_ID.test(params.id) || !(await prisma.contact.findUnique({ where: { id: params.id }, select: { id: true } }))) {
        return apiError(404, "not_found", "Lead not found.");
    }
    // id breaks ties: two events in the same millisecond still list newest first.
    const rows = await prisma.activity.findMany({ where: { contactId: params.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 });
    const staffIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x) => x !== "AI")));
    const staff = staffIds.length ? await mysql.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true } }) : [];
    return Response.json({
        items: rows.map((r) => {
            const s = staff.find((u) => u.id === r.createdBy);
            return { ...r, createdByName: r.createdBy === "AI" ? "AI assistant" : s?.name ?? s?.email ?? "Team member" };
        }),
    });
}
