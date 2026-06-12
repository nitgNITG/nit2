/**
 * Slugify a string for use in URLs.
 * Keeps Arabic characters (valid in URLs, great for Arabic SEO),
 * plus Latin letters, digits, and hyphens.
 *
 * Examples:
 *   "كم تكلفة تطوير منصة Moodle في مصر 2026؟"
 *   → "كم-تكلفة-تطوير-منصة-moodle-في-مصر-2026"
 *
 *   "Moodle vs Blackboard: Which is Better for Arab Universities?"
 *   → "moodle-vs-blackboard-which-is-better-for-arab-universities"
 */
export function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        // Replace spaces (and common punctuation) with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove anything that isn't Arabic letter, Latin letter, digit, or hyphen
        .replace(/[^\u0621-\u064A\u0660-\u0669a-z0-9-]/g, '')
        // Collapse consecutive hyphens
        .replace(/-{2,}/g, '-')
        // Strip leading/trailing hyphens
        .replace(/^-+|-+$/g, '');
}
