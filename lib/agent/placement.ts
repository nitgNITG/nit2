// Where the chat widget may appear (FR-W1). Pure — shared by the server (E1) and
// the client widget, so both apply the same rule.

// No widget on dashboard, payment and sign-in pages.
const EXCLUDED = [/^\/dashboard(\/|$)/, /^\/payment(\/|$)/, /^\/account(\/|$)/, /^\/forgot-password(\/|$)/, /^\/verify-email(\/|$)/];

/** Path without the /ar or /en prefix. */
export function stripLocale(path: string): string {
    return path.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
}

export function widgetAllowedOn(path: string | null | undefined): boolean {
    if (!path) return true;
    const p = stripLocale(path.split("?")[0]);
    return !EXCLUDED.some((re) => re.test(p));
}
