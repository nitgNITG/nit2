// Staff edits of a lead's scoring fields (US-35, FR-L3, AC-35.1). Any change is
// re-scored at once with the current settings and a new scoredAt.
import { z } from "zod";
import prisma from "@/prisma/client";
import { getAgentConfig } from "./config";
import { budgetBand, LeadRequirementsSchema, ORG_TYPES, TIMELINES } from "./qualification/schemas";
import { scoreFields } from "./scoring/recalc";

export const LeadEditSchema = z.strictObject({
    country: z.string().regex(/^[A-Za-z]{2}$/).nullable().optional(),
    orgType: z.enum(ORG_TYPES).nullable().optional(),
    role: z.enum(["owner", "manager", "employee", "other"]).nullable().optional(),
    timeline: z.enum(TIMELINES).nullable().optional(),
    company: z.string().trim().max(120).nullable().optional(),
    status: z.enum(["new", "contacted", "won", "lost"]).optional(),
    notes: z.string().max(5000).nullable().optional(),
    requirements: LeadRequirementsSchema.optional(),
});
export type LeadEdit = z.infer<typeof LeadEditSchema>;

export async function updateLead(id: string, edit: LeadEdit) {
    if (!/^[a-f0-9]{24}$/.test(id)) return null;
    const c = await prisma.contact.findUnique({ where: { id } });
    if (!c) return null;

    const req: Record<string, unknown> = { ...((c.requirements as Record<string, unknown> | null) ?? {}), ...(edit.requirements ?? {}) };
    if (edit.country !== undefined) req.country = edit.country ? edit.country.toUpperCase() : undefined;
    if (edit.orgType !== undefined) req.orgType = edit.orgType ?? undefined;
    if (edit.timeline !== undefined) req.timeline = edit.timeline ?? undefined;
    for (const k of Object.keys(req)) if (req[k] === undefined) delete req[k];

    const fields = {
        ...(edit.country !== undefined ? { country: edit.country ? edit.country.toLowerCase() : null } : {}),
        ...(edit.orgType !== undefined ? { orgType: edit.orgType } : {}),
        ...(edit.role !== undefined ? { role: edit.role } : {}),
        ...(edit.timeline !== undefined ? { timeline: edit.timeline } : {}),
        ...(edit.company !== undefined ? { company: edit.company } : {}),
        ...(edit.status !== undefined ? { status: edit.status } : {}),
        ...(edit.notes !== undefined ? { notes: edit.notes } : {}),
        budget: budgetBand((req.budgetMinUsd ?? req.budgetMaxUsd) as number | undefined) ?? c.budget ?? null,
        requirements: req as object,
    };
    const cfg = await getAgentConfig();
    const score = scoreFields({ ...c, ...fields }, cfg.scoring, cfg.version);
    return prisma.contact.update({ where: { id }, data: { ...fields, ...score } });
}
