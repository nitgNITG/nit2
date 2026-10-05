// Custom-project price ranges maintained by sales (FR-S12, D9). Versioned saves:
// a save based on a stale version is refused, so two editors never overwrite
// each other silently (TS-55).
import { z } from "zod";
import prisma from "@/prisma/client";
import { bumpKnowledgeVersion } from "./knowledge/version";

export const PriceRangeSchema = z
    .strictObject({
        version: z.number().int().min(0).optional(), // the version you edited; omit / 0 to create
        labelAr: z.string().trim().min(1).max(120),
        labelEn: z.string().trim().min(1).max(120),
        minUsd: z.number().int().min(0).max(100_000_000),
        maxUsd: z.number().int().min(0).max(100_000_000).nullable().optional(),
        notesAr: z.string().trim().max(500).nullable().optional(),
        notesEn: z.string().trim().max(500).nullable().optional(),
        active: z.boolean(),
    })
    .refine((r) => r.maxUsd == null || r.maxUsd >= r.minUsd, { message: "maxUsd must be at least minUsd" });
export type PriceRangeInput = z.infer<typeof PriceRangeSchema>;

export async function savePriceRange(category: string, input: PriceRangeInput, userId: string) {
    const { version, ...fields } = input;
    const data = {
        ...fields,
        maxUsd: fields.maxUsd ?? null,
        notesAr: fields.notesAr || null,
        notesEn: fields.notesEn || null,
        updatedBy: userId,
    };
    const existing = await prisma.customPriceRange.findUnique({ where: { category } });
    if (!existing) {
        if (version) return "conflict" as const; // it was deleted meanwhile
        try {
            const row = await prisma.customPriceRange.create({ data: { category, ...data, version: 1 } });
            await bumpKnowledgeVersion();
            return row;
        } catch {
            return "conflict" as const; // created concurrently
        }
    }
    if (version !== existing.version) return "conflict" as const;
    const res = await prisma.customPriceRange.updateMany({
        where: { category, version },
        data: { ...data, version: { increment: 1 } },
    });
    if (res.count !== 1) return "conflict" as const;
    await bumpKnowledgeVersion();
    return prisma.customPriceRange.findUnique({ where: { category } });
}
