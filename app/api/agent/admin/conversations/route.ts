// E6 — GET /api/agent/admin/conversations (staff: sales or support). FR-I1, FR-I5.
// Filters: status, mode, channel, hasLead, from, to (YYYY-MM-DD), skip, take.
import prisma from "@/prisma/client";
import { allowedModes, guard } from "@/lib/agent/admin";
import { apiError } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["open", "waiting_human", "human", "closed"];

export async function GET(req: Request) {
    const g = await guard("conversations:sales", "conversations:support");
    if (g.res) return g.res;
    const modes = allowedModes(g.staff);

    const q = new URL(req.url).searchParams;
    const status = q.get("status");
    const mode = q.get("mode");
    const channel = q.get("channel");
    const hasLead = q.get("hasLead");
    const from = q.get("from");
    const to = q.get("to");
    if (status && !STATUSES.includes(status)) return apiError(400, "invalid_query", "Unknown status.");
    if (channel && !["web", "whatsapp"].includes(channel)) return apiError(400, "invalid_query", "Unknown channel.");
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return apiError(400, "invalid_query", "Dates are YYYY-MM-DD.");
    if (mode && !["sales", "support"].includes(mode)) return apiError(400, "invalid_query", "Unknown mode.");
    if (mode && !modes.includes(mode as "sales" | "support")) return apiError(403, "forbidden", "Not allowed.");
    const skip = Math.max(0, parseInt(q.get("skip") ?? "0", 10) || 0);
    const take = Math.min(100, Math.max(1, parseInt(q.get("take") ?? "20", 10) || 20));

    const where = {
        mode: mode ? mode : { in: modes },
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
        ...(hasLead === "true" ? { contactId: { isSet: true, not: null } } : hasLead === "false" ? { OR: [{ contactId: null }, { contactId: { isSet: false } }] } : {}),
        ...(from || to
            ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) } : {}) } }
            : {}),
    };

    const [total, rows] = await Promise.all([
        prisma.conversation.count({ where }),
        prisma.conversation.findMany({ where, orderBy: { lastMessageAt: "desc" }, skip, take }),
    ]);
    const contactIds = rows.map((r) => r.contactId).filter((x): x is string => !!x);
    const contacts = contactIds.length
        ? await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, tier: true, score: true, country: true } })
        : [];
    const previews = await Promise.all(rows.map((r) => prisma.chatMessage.findFirst({
        where: { conversationId: r.id, role: { in: ["visitor", "assistant", "staff"] } },
        orderBy: { createdAt: "desc" },
        select: { role: true, content: true },
    })));

    return Response.json({
        total,
        items: rows.map((r, i) => ({
            id: r.id, channel: r.channel, mode: r.mode, status: r.status, locale: r.locale,
            contact: contacts.find((c) => c.id === r.contactId) ?? null,
            lastMessageAt: r.lastMessageAt, createdAt: r.createdAt, assignedTo: r.assignedTo ?? null, rating: r.rating ?? null,
            preview: previews[i] ? `${previews[i]!.role}: ${previews[i]!.content.slice(0, 120)}` : "",
        })),
    });
}
