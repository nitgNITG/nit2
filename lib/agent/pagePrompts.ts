// Page-aware prompt (FR-W10): the highest-priority enabled rule whose matcher fits
// the page (path prefix after the locale, or "*") and whose locale fits.
import type { PagePromptRule } from "./config";
import { stripLocale, widgetAllowedOn } from "./http";

export function pickPagePrompt(
    rules: PagePromptRule[],
    page: string | null,
    locale: "ar" | "en",
): { id: string; text: string; delaySec: number } | null {
    if (!page || !widgetAllowedOn(page)) return null;
    const path = stripLocale(page.split("?")[0]);
    const match = rules
        .filter((r) => r.enabled && (r.locale === "any" || r.locale === locale))
        .filter((r) => r.matcher === "*" || path === r.matcher || path.startsWith(`${r.matcher.replace(/\/$/, "")}/`))
        .sort((a, b) => b.priority - a.priority)[0];
    return match ? { id: match.id, text: match.message[locale], delaySec: match.delaySeconds } : null;
}
