// Agent staff permissions (FR-C4, FR-I5, §13.14). role = admin (or legacy null)
// has every capability; everyone else has exactly the agentPermissions on their
// MySQL User row. The existing admin / client roles are unchanged (D12).
import mysql from "@/lib/prismaMysql";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export const AGENT_PERMISSIONS = ["sales", "support", "viewer"] as const;
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export type Capability =
    | "conversations:sales"
    | "conversations:support"
    | "leads"
    | "price_ranges"
    | "meetings"
    | "tickets"
    | "analytics"
    | "settings"
    | "staff"
    | "drafts";

const MATRIX: Record<Capability, AgentPermission[]> = {
    "conversations:sales": ["sales"],
    "conversations:support": ["support"],
    leads: ["sales"],
    price_ranges: ["sales"],
    meetings: ["sales"],
    tickets: ["support"],
    analytics: ["sales", "viewer"],
    settings: [],
    staff: [],
    drafts: ["sales"],
};

export type AgentStaff = { user: SessionUser; isAdmin: boolean; permissions: AgentPermission[] };

export function parsePermissions(raw: unknown): AgentPermission[] {
    if (!Array.isArray(raw)) return [];
    return AGENT_PERMISSIONS.filter((p) => raw.includes(p));
}

export function can(staff: AgentStaff, cap: Capability): boolean {
    if (staff.isAdmin) return true;
    return MATRIX[cap].some((p) => staff.permissions.includes(p));
}

/** Conversation capability for a mode (sales / support). */
export function conversationCap(mode: string): Capability {
    return mode === "support" ? "conversations:support" : "conversations:sales";
}

/** Re-reads the signed-in user and their agent permissions on every call (A-03). */
export async function getAgentStaff(): Promise<AgentStaff | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    if (user.role === "admin") return { user, isAdmin: true, permissions: [...AGENT_PERMISSIONS] };
    const row = await mysql.user.findUnique({ where: { id: user.id }, select: { agentPermissions: true } });
    return { user, isAdmin: false, permissions: parsePermissions(row?.agentPermissions) };
}

type Guard = { ok: true; staff: AgentStaff } | { ok: false; status: 401 | 403 };

/** 401 when signed out, 403 when none of the capabilities is allowed. */
export async function requireCapability(...caps: Capability[]): Promise<Guard> {
    const staff = await getAgentStaff();
    if (!staff) return { ok: false, status: 401 };
    if (!caps.some((c) => can(staff, c))) return { ok: false, status: 403 };
    return { ok: true, staff };
}
