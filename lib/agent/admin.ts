// Staff-side helpers for the /api/agent/admin/** routes and the dashboard
// (FR-I1–I5, FR-C3, FR-C4, §13.14). Route files stay thin; decisions live here.
import { apiError } from "./http";
import { can, requireCapability, type AgentStaff, type Capability } from "./security/authorization";

/** Conversation modes a staff member may see. Empty = none. */
export function allowedModes(staff: AgentStaff): ("sales" | "support")[] {
    const modes: ("sales" | "support")[] = [];
    if (can(staff, "conversations:sales")) modes.push("sales");
    if (can(staff, "conversations:support")) modes.push("support");
    return modes;
}

/** Guard for a route: the staff member, or the 401/403 response to return. */
export async function guard(...caps: Capability[]): Promise<{ staff: AgentStaff; res?: never } | { staff?: never; res: Response }> {
    const g = await requireCapability(...caps);
    if (!g.ok) return { res: apiError(g.status, g.status === 401 ? "unauthorized" : "forbidden", g.status === 401 ? "Sign in first." : "Not allowed.") };
    return { staff: g.staff };
}

// Dashboard pages an agent-staff member (non-admin) may open, and what each needs.
const PAGES: { prefix: string; caps: Capability[] }[] = [
    { prefix: "/dashboard/conversations", caps: ["conversations:sales", "conversations:support"] },
    { prefix: "/dashboard/price-ranges", caps: ["price_ranges"] },
    { prefix: "/dashboard/agent-usage", caps: ["analytics"] },
    { prefix: "/dashboard/agent-settings", caps: ["settings"] },
    { prefix: "/dashboard/agent-staff", caps: ["staff"] },
];

/** Is this dashboard path (locale already stripped) open to the staff member? Unknown paths: admins only. */
export function dashboardPathAllowed(path: string, staff: AgentStaff): boolean {
    if (staff.isAdmin) return true;
    const page = PAGES.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`));
    return !!page && page.caps.some((c) => can(staff, c));
}

/** First dashboard page the staff member may open (their landing page), or null. */
export function staffLandingPage(staff: AgentStaff): string | null {
    return PAGES.find((p) => p.caps.some((c) => can(staff, c)))?.prefix ?? null;
}

export type NavItem = { label: string; href: string };

/** Agent links for the sidebar, filtered by capability. */
export function agentNav(staff: AgentStaff): NavItem[] {
    const items: (NavItem & { caps: Capability[] })[] = [
        { label: "💬 AI Inbox", href: "/dashboard/conversations", caps: ["conversations:sales", "conversations:support"] },
        { label: "💵 Price Ranges", href: "/dashboard/price-ranges", caps: ["price_ranges"] },
        { label: "📈 AI Usage", href: "/dashboard/agent-usage", caps: ["analytics"] },
        { label: "🤖 AI Settings", href: "/dashboard/agent-settings", caps: ["settings"] },
        { label: "👥 AI Staff", href: "/dashboard/agent-staff", caps: ["staff"] },
    ];
    return items.filter((i) => i.caps.some((c) => can(staff, c))).map(({ label, href }) => ({ label, href }));
}
