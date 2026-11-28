// search_knowledge, search_projects, get_price_range (FR-S7, FR-S11, FR-S12).
import { z } from "zod";
import prisma from "@/prisma/client";
import { searchKnowledge } from "../../knowledge/search";
import { normalize, scoreDoc } from "../../knowledge/search";
import { defineTool, ok } from "../types";

export const searchKnowledgeTool = defineTool({
    name: "search_knowledge",
    description: "Search NITG's approved FAQ, service pages and articles. Returns up to 5 { title, snippet, url, sourceId }. Answer only from what it returns.",
    modes: ["sales", "support"],
    writes: false,
    schema: z.strictObject({ query: z.string().trim().min(2).max(200), locale: z.enum(["ar", "en"]) }),
    async run(_ctx, { query, locale }) {
        const hits = await searchKnowledge(query, locale);
        return ok(hits, hits.map((h) => ({ sourceId: h.sourceId, sourceType: h.sourceType, title: h.title, url: h.url })));
    },
});

export const searchProjects = defineTool({
    name: "search_projects",
    description:
        "Find previous NITG projects similar to the visitor's need. type is a project type slug (e.g. lms, ecommerce) when known. Returns up to 5 { title, description, url, types }; an empty list means none match — say so. Mention ONLY these projects.",
    modes: ["sales", "support"],
    writes: false,
    schema: z.strictObject({
        type: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional(),
        query: z.string().trim().max(200),
        locale: z.enum(["ar", "en"]),
    }),
    async run(_ctx, { type, query, locale }) {
        const rows = await prisma.project.findMany({
            where: { NOT: { aiVisible: false }, ...(type ? { types: { has: type } } : {}) },
            orderBy: [{ important: "desc" }, { order: "asc" }],
            take: 200,
        });
        const terms = normalize(query).split(/\s+/).filter((t) => t.length >= 2);
        const en = locale === "en";
        const ranked = rows
            .map((p) => {
                const title = (en ? p.titleEn : null) || p.title;
                const description = (en ? p.descriptionEn : null) || p.description;
                return { p, title, description, s: terms.length ? scoreDoc({ title, text: `${description} ${p.aiSummary ?? ""}` }, terms) : 1 };
            })
            .filter((x) => x.s > 0 || !!type)
            .sort((a, b) => b.s - a.s)
            .slice(0, 5);
        const items = ranked.map(({ p, title, description }) => {
            const link = p.links?.find((l) => /^https?:\/\//.test(l.link))?.link;
            return {
                sourceId: `project:${p.id}`,
                title,
                description: description.length > 300 ? `${description.slice(0, 300)}…` : description,
                url: link ?? `/${locale}/our-projects`,
                types: p.types,
            };
        });
        return ok(items, items.map((i) => ({ sourceId: i.sourceId, sourceType: "project", title: i.title, url: i.url })));
    },
});

/** The visitor's country if they told us (lead draft, requirements or saved lead), as ISO-2. */
async function visitorCountry(conversationId: string): Promise<string | null> {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { qualification: true, contactId: true } });
    const q = (conv?.qualification ?? {}) as { requirements?: { country?: string }; lead?: { country?: string } };
    let country = q.requirements?.country ?? q.lead?.country ?? null;
    if (!country && conv?.contactId) {
        country = (await prisma.contact.findUnique({ where: { id: conv.contactId }, select: { country: true } }))?.country ?? null;
    }
    return country && /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null;
}

/**
 * Which currency to quote — decided by the SERVER: the visitor's stated country
 * first (Egypt → EGP, elsewhere → USD), else the model's hint, else USD; and only
 * a currency sales actually filled in. Amounts are never converted.
 */
export function quoteCurrency(country: string | null, hint: "EGP" | "USD" | undefined, hasEgp: boolean): "EGP" | "USD" {
    const wanted = country ? (country === "EG" ? "EGP" : "USD") : hint ?? "USD";
    return wanted === "EGP" && hasEgp ? "EGP" : "USD";
}

export const getPriceRange = defineTool({
    name: "get_price_range",
    description:
        "Get the sales-approved indicative price range for a custom-project category, e.g. custom_lms, lms_mobile_apps, ecommerce_app, delivery_app, restaurant_app, loyalty_app, school_management, website, custom_software. Set currency to EGP when the visitor seems to be in Egypt (Egyptian dialect, mentions Egypt or Egyptian pounds), otherwise leave it out; the server decides the final currency. Quote min/max EXACTLY in the returned currency (no conversion) and say the final quotation depends on scope. { available: false } means there is no approved range for that category: if otherCategories lists one that fits the visitor's project, call again with it; otherwise give NO number, say sales will send a quotation and offer a person.",
    modes: ["sales"],
    writes: false,
    schema: z.strictObject({
        category: z.string().regex(/^[a-z0-9_]{1,60}$/),
        currency: z.enum(["EGP", "USD"]).optional(), // a hint only
    }),
    async run(ctx, { category, currency: hint }) {
        const r = await prisma.customPriceRange.findUnique({ where: { category } });
        const en = ctx.locale === "en";
        if (!r || !r.active) {
            // Let the model retry with a real key; only ACTIVE (sales-approved) ranges are ever listed.
            const active = await prisma.customPriceRange.findMany({ where: { active: true }, select: { category: true, labelEn: true, labelAr: true }, orderBy: { category: "asc" } });
            const otherCategories = active.filter((x) => x.category !== category).map((x) => ({ category: x.category, label: en ? x.labelEn : x.labelAr }));
            return ok({ available: false, ...(otherCategories.length ? { otherCategories } : {}) });
        }
        const currency = quoteCurrency(await visitorCountry(ctx.conversationId), hint, r.minEgp != null);
        const min = currency === "EGP" ? r.minEgp! : r.minUsd;
        const max = currency === "EGP" ? r.maxEgp : r.maxUsd;
        return ok(
            {
                available: true, label: en ? r.labelEn : r.labelAr, currency, min,
                ...(max != null ? { max } : { startingFrom: true }),
                notes: (en ? r.notesEn : r.notesAr) ?? undefined,
            },
            [{ sourceId: `price_range:${r.category}`, sourceType: "price_range", title: r.labelEn }],
        );
    },
});
