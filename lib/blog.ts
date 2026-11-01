// Blog helpers shared by the public pages, the dashboard editor and the API routes.

/** Prisma filter for articles visitors may see: anything whose publish time has come. */
export const publishedWhere = (now: Date = new Date()) => ({ publishedAt: { lte: now } });

/** Sections in their saved position; older sections without `order` keep creation order. */
export const SECTION_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];

export const isScheduled =(publishedAt: Date | string | null | undefined, now: Date = new Date()) =>
    !!publishedAt && new Date(publishedAt).getTime() > now.getTime();

/**
 * Parse an optional publish time sent by the dashboard (ISO string).
 * `undefined` → not sent, `null` → invalid.
 */
export function parsePublishedAt(value: FormDataEntryValue | string | null | undefined): Date | null | undefined {
    if (value == null || value === "") return undefined;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
}

export type RichToken =
    | { type: "text"; value: string }
    | { type: "link"; label: string; href: string; external: boolean }
    | { type: "break" };

// [label](href) — label without brackets, href without spaces or parentheses.
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Site-relative paths ("/ar/blog/x") and http(s) URLs only; anything else stays plain text. */
export function safeHref(href: string): { href: string; external: boolean } | null {
    if (href.startsWith("/") && !href.startsWith("//")) return { href, external: false };
    if (/^https?:\/\/[^\s]+$/i.test(href)) return { href, external: true };
    return null;
}

/** Split article text into plain text, links written as [label](href), and line breaks. */
export function parseRichText(text: string | null | undefined): RichToken[] {
    const out: RichToken[] = [];
    const pushText = (s: string) => {
        s.split("\n").forEach((part, i) => {
            if (i > 0) out.push({ type: "break" });
            if (part) out.push({ type: "text", value: part });
        });
    };
    if (!text) return out;
    let last = 0;
    const re = new RegExp(LINK.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const safe = safeHref(m[2]);
        if (!safe) continue;
        pushText(text.slice(last, m.index));
        out.push({ type: "link", label: m[1], ...safe });
        last = m.index + m[0].length;
    }
    pushText(text.slice(last));
    return out;
}

/** Plain text for excerpts and meta descriptions: links keep their label, breaks become spaces. */
export function stripRichText(text: string | null | undefined): string {
    return parseRichText(text)
        .map((t) => (t.type === "text" ? t.value : t.type === "link" ? t.label : " "))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
}
