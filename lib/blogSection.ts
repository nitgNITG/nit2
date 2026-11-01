// Normalises a section payload from the dashboard into what the Section model stores.

type ListItemInput = { title?: unknown; titleEn?: unknown; content?: unknown; contentEn?: unknown };

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Returns null when the section has no Arabic H2 title (the one required field). */
export function toSectionData(body: Record<string, unknown>) {
    const title = text(body.title);
    if (!title) return null;
    const list = Array.isArray(body.list) ? (body.list as ListItemInput[]) : [];
    return {
        title,
        titleEn: text(body.titleEn),
        content: text(body.content),
        contentEn: text(body.contentEn),
        // H3 items without an Arabic title would render as empty headings; drop them.
        list: list
            .map((i) => ({ title: text(i?.title), titleEn: text(i?.titleEn), content: text(i?.content), contentEn: text(i?.contentEn) }))
            .filter((i) => i.title),
    };
}
