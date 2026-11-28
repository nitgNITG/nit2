// On-demand knowledge search (FR-S7, FR-A10): keyword match over approved FAQ,
// service data and aiVisible articles. Small corpus → no vector DB (§2.3).
import prisma from "@/prisma/client";
import type { Locale } from "../tools/types";
import { staticDocs, type KnowledgeDoc } from "./sources";

// Built at runtime: tsconfig has no target, so TS rejects a /u regex literal.
const NON_WORD = new RegExp("[^\\p{L}\\p{N}\\s]", "gu");
const DIACRITICS = new RegExp("[\\u064B-\\u0652\\u0640]", "g"); // harakat + tatweel

/** Lower-case, strip Arabic diacritics/tatweel, unify alef/ya/ta-marbuta forms. */
export function normalize(s: string): string {
    return s
        .toLowerCase()
        .replace(DIACRITICS, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(NON_WORD, " ");
}

const STOP = new Set([
    "the", "and", "for", "you", "your", "what", "how", "can", "are", "with", "does", "have", "about",
    "في", "من", "علي", "عن", "هل", "ما", "ماذا", "كيف", "او", "مع", "الي", "انا", "انتم", "عايز", "ايه",
]);

function terms(q: string): string[] {
    return Array.from(new Set(normalize(q).split(/\s+/).filter((t) => t.length >= 2 && !STOP.has(t))));
}

/** Score a doc: title hits count double; a term may match as a prefix (Arabic "ال"-prefixed too). */
export function scoreDoc(doc: Pick<KnowledgeDoc, "title" | "text">, qTerms: string[]): number {
    const title = normalize(doc.title);
    const body = normalize(doc.text);
    let score = 0;
    for (const t of qTerms) {
        const re = new RegExp(`(^|\\s)(ال)?${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u");
        if (re.test(title)) score += 2;
        if (re.test(body)) score += 1;
    }
    return score;
}

export type SearchHit = { sourceId: string; sourceType: string; title: string; snippet: string; url?: string };

async function articleDocs(locale: Locale): Promise<KnowledgeDoc[]> {
    const rows = await prisma.article.findMany({
        where: { NOT: { aiVisible: false } },
        select: { id: true, slug: true, title: true, titleEn: true, content: true, contentEn: true, metaDesc: true, metaDescEn: true, aiSummary: true },
        orderBy: { publishedAt: "desc" },
        take: 300,
    });
    return rows.map((a) => {
        const en = locale === "en";
        return {
            sourceId: `article:${a.id}`,
            sourceType: "article" as const,
            title: (en ? a.titleEn : null) || a.title,
            text: [a.aiSummary, (en ? a.metaDescEn : a.metaDesc), (en ? a.contentEn : null) || a.content].filter(Boolean).join("\n"),
            url: `/blog/${a.slug || a.id}`,
        };
    });
}

export async function searchKnowledge(query: string, locale: Locale, limit = 5): Promise<SearchHit[]> {
    const qTerms = terms(query);
    if (!qTerms.length) return [];
    let docs = staticDocs(locale);
    try {
        docs = docs.concat(await articleDocs(locale));
    } catch (e) {
        console.error("[agent] article search failed", (e as Error).message);
    }
    return docs
        .map((d) => ({ d, s: scoreDoc(d, qTerms) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map(({ d }) => ({
            sourceId: d.sourceId,
            sourceType: d.sourceType,
            title: d.title,
            snippet: d.text.length > 600 ? `${d.text.slice(0, 600)}…` : d.text,
            url: d.url ? `/${locale}${d.url === "/" ? "" : d.url}` : undefined,
        }));
}
