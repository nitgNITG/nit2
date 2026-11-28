// Staff-side helpers for the /api/agent/admin/** routes and the dashboard
// (FR-I1–I5, FR-C3, FR-C4, §13.14). Route files stay thin; decisions live here.
import { apiError } from "./http";
import type { NavItem } from "@/lib/dashboard/nav";
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** from/to query (YYYY-MM-DD, inclusive, at most `maxDays`), or the 400 to return. */
export function parseDateRange(q: URLSearchParams, maxDays = 90): { from: string; to: string; res?: never } | { res: Response } {
    const from = q.get("from");
    const to = q.get("to");
    if (!from || !to || !DATE.test(from) || !DATE.test(to)) return { res: apiError(400, "invalid_query", "from and to are required (YYYY-MM-DD).") };
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1) return { res: apiError(400, "invalid_query", "to must not be before from.") };
    if (days > maxDays) return { res: apiError(400, "invalid_query", `At most ${maxDays} days.`) };
    return { from, to };
}

// Dashboard pages an agent-staff member (non-admin) may open, and what each needs.
const PAGES: { prefix: string; caps: Capability[] }[] = [
    { prefix: "/dashboard/conversations", caps: ["conversations:sales", "conversations:support"] },
    { prefix: "/dashboard/price-ranges", caps: ["price_ranges"] },
    { prefix: "/dashboard/agent-usage", caps: ["analytics"] },
    { prefix: "/dashboard/agent-settings", caps: ["settings"] },
    { prefix: "/dashboard/agent-staff", caps: ["staff"] },
    { prefix: "/dashboard/agent-analytics", caps: ["analytics"] },
    { prefix: "/dashboard/tickets", caps: ["tickets"] },
    { prefix: "/dashboard/meetings", caps: ["meetings"] },
    { prefix: "/dashboard/follow-ups", caps: ["drafts"] },
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

/** The AI-agent pages this staff member may open, for the grouped dashboard sidebar. */
export function agentNav(staff: AgentStaff): NavItem[] {
    const items: (NavItem & { caps: Capability[] })[] = [
        { label: "AI Inbox", href: "/dashboard/conversations", group: "sales", icon: "inbox", badge: "inbox", caps: ["conversations:sales", "conversations:support"] },
        { label: "Price Ranges", href: "/dashboard/price-ranges", group: "sales", icon: "priceRanges", caps: ["price_ranges"] },
        { label: "Tickets", href: "/dashboard/tickets", group: "customers", icon: "tickets", caps: ["tickets"] },
        { label: "Meetings", href: "/dashboard/meetings", group: "sales", icon: "meetings", caps: ["meetings"] },
        { label: "Follow-ups", href: "/dashboard/follow-ups", group: "sales", icon: "followups", badge: "drafts", caps: ["drafts"] },
        { label: "AI Usage & Cost", href: "/dashboard/agent-usage", group: "ai", icon: "usage", caps: ["analytics"] },
        { label: "AI Analytics", href: "/dashboard/agent-analytics", group: "ai", icon: "analytics", caps: ["analytics"] },
        { label: "AI Settings", href: "/dashboard/agent-settings", group: "ai", icon: "aiSettings", caps: ["settings"] },
        { label: "AI Staff", href: "/dashboard/agent-staff", group: "ai", icon: "staff", caps: ["staff"] },
    ];
    return items.filter((i) => i.caps.some((c) => can(staff, c))).map(({ caps: _caps, ...item }) => item);
}
