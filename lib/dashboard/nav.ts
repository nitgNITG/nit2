// Dashboard navigation: grouped sections + icon names. Icons are referenced by
// name so the server layout can pass the AI-agent items (filtered by the staff
// member's permissions) to the client Sidebar, which maps names to icons.

export const NAV_GROUPS = [
    { key: 'overview', label: 'Overview' },
    { key: 'sales', label: 'Sales & CRM' },
    { key: 'customers', label: 'Customers & Support' },
    { key: 'billing', label: 'Billing' },
    { key: 'content', label: 'Website Content' },
    { key: 'ai', label: 'AI Assistant' },
    { key: 'system', label: 'System' },
] as const
export type NavGroup = (typeof NAV_GROUPS)[number]['key']

export type NavIcon =
    | 'dashboard' | 'projects' | 'types' | 'sponsors' | 'contacts' | 'blog' | 'plans' | 'academies' | 'stores'
    | 'payments' | 'revenue' | 'licenses' | 'platform' | 'integrations' | 'health' | 'inbox' | 'priceRanges'
    | 'tickets' | 'meetings' | 'usage' | 'analytics' | 'aiSettings' | 'staff' | 'followups'

export type NavItem = { label: string; href: string; group: NavGroup; icon: NavIcon; badge?: 'contacts' | 'inbox' | 'drafts' }

/** The admin-only pages. The AI-agent pages come from agentNav() (lib/agent/admin.ts). */
export const ADMIN_NAV: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', group: 'overview', icon: 'dashboard' },
    { label: 'Contacts', href: '/dashboard/contacts', group: 'sales', icon: 'contacts', badge: 'contacts' },
    { label: 'Academies', href: '/dashboard/academies', group: 'customers', icon: 'academies' },
    { label: 'Stores', href: '/dashboard/stores', group: 'customers', icon: 'stores' },
    { label: 'Plans & Pricing', href: '/dashboard/plans', group: 'billing', icon: 'plans' },
    { label: 'Licenses', href: '/dashboard/licenses', group: 'billing', icon: 'licenses' },
    { label: 'Payments', href: '/dashboard/payments', group: 'billing', icon: 'payments' },
    { label: 'Revenue', href: '/dashboard/revenue', group: 'billing', icon: 'revenue' },
    { label: 'Projects', href: '/dashboard/projects', group: 'content', icon: 'projects' },
    { label: 'Project Types', href: '/dashboard/types', group: 'content', icon: 'types' },
    { label: 'Sponsors', href: '/dashboard/sponsers', group: 'content', icon: 'sponsors' },
    { label: 'Blog', href: '/dashboard/blog', group: 'content', icon: 'blog' },
    { label: 'Platform Settings', href: '/dashboard/platform-settings', group: 'system', icon: 'platform' },
    { label: 'Integrations', href: '/dashboard/integrations', group: 'system', icon: 'integrations' },
    { label: 'Setup & Health', href: '/dashboard/setup', group: 'system', icon: 'health' },
]

/** Order inside a group (admin and AI-agent items interleave); unknown pages go last. */
const ORDER = [
    '/dashboard',
    '/dashboard/conversations', '/dashboard/contacts', '/dashboard/follow-ups', '/dashboard/meetings', '/dashboard/price-ranges',
    '/dashboard/academies', '/dashboard/stores', '/dashboard/tickets',
    '/dashboard/plans', '/dashboard/licenses', '/dashboard/payments', '/dashboard/revenue',
    '/dashboard/projects', '/dashboard/types', '/dashboard/sponsers', '/dashboard/blog',
    '/dashboard/agent-usage', '/dashboard/agent-analytics', '/dashboard/agent-settings', '/dashboard/agent-staff',
    '/dashboard/platform-settings', '/dashboard/integrations', '/dashboard/setup',
]
const rank = (href: string) => { const i = ORDER.indexOf(href); return i === -1 ? ORDER.length : i }

/** Items by group (fixed group order, then ORDER inside each group); empty groups dropped. */
export function groupNav(items: NavItem[]): { key: NavGroup; label: string; items: NavItem[] }[] {
    return NAV_GROUPS
        .map((g) => ({ ...g, items: items.filter((i) => i.group === g.key).sort((a, b) => rank(a.href) - rank(b.href)) }))
        .filter((g) => g.items.length > 0)
}

/** Active when on the page or one of its sub-pages; the dashboard home only on itself. */
export function isActive(pathname: string, locale: string, href: string): boolean {
    const full = `/${locale}${href}`
    return href === '/dashboard' ? pathname === full : pathname === full || pathname.startsWith(`${full}/`)
}
