// Staff agent permissions (E22, FR-C4, D12). Stored on the MySQL User as a JSON
// array; an empty set is stored as NULL so "has permissions" is a simple filter.
import { Prisma } from "prismamysql";
import mysql from "@/lib/prismaMysql";
import { AGENT_PERMISSIONS, parsePermissions, type AgentPermission } from "./security/authorization";

const SELECT = { id: true, email: true, name: true, role: true, agentPermissions: true } as const;
type Row = { id: string; email: string; name: string | null; role: string | null; agentPermissions: unknown };

function view(u: Row) {
    const isAdmin = u.role === "admin" || u.role == null;
    return {
        userId: u.id, name: u.name, email: u.email, role: isAdmin ? "admin" : "client",
        permissions: isAdmin ? [...AGENT_PERMISSIONS] : parsePermissions(u.agentPermissions),
    };
}

/** No query: admins + everyone holding a permission. Query: email search (to grant one). */
export async function listStaff(q: string) {
    const rows: Row[] = q
        ? await mysql.user.findMany({ where: { email: { contains: q } }, select: SELECT, take: 20, orderBy: { email: "asc" } })
        : await mysql.user.findMany({
            where: { OR: [{ role: "admin" }, { role: null }, { agentPermissions: { not: Prisma.DbNull } }] },
            select: SELECT, take: 200, orderBy: { email: "asc" },
        });
    return rows.map(view).filter((u) => q || u.role === "admin" || u.permissions.length > 0);
}

export async function setPermissions(userId: string, permissions: AgentPermission[]) {
    const existing = await mysql.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!existing) return null;
    const unique = AGENT_PERMISSIONS.filter((p) => permissions.includes(p));
    const row = await mysql.user.update({
        where: { id: userId },
        data: { agentPermissions: unique.length ? unique : Prisma.DbNull },
        select: SELECT,
    });
    return view(row);
}
