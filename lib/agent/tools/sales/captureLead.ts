// capture_lead (FR-S3–S5, FR-S9, FR-S10, FR-F5, FR-L1–L5). One Contact per
// conversation, created once the visitor is contactable and updated on every later
// call. Scores come only from code: the strict schema rejects score/tier fields.
import { z } from "zod";
import prisma from "@/prisma/client";
import { computeLeadScore } from "@/utils/leadScore";
import { isBlockedEmailDomain, isValidEmail, normalizePhone } from "@/lib/spamRules";
import { alertHotLead, alertQualifiedLead, type LeadAlertFields } from "../../alerts";
import { applyAnswers, nextQuestion, readSession, type QualificationSession } from "../../qualification/engine";
import {
    budgetBand, contactServiceFor, LeadRequirementsSchema, ORG_TYPES, serviceForProjectType,
} from "../../qualification/schemas";
import { generateBrief } from "../../runtime/brief";
import { scoreFields } from "../../scoring/recalc";
import { defineTool, fail, ok, type ToolContext } from "../types";

export const CaptureLeadSchema = z.strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    email: z.string().trim().toLowerCase().max(200).optional(),
    whatsapp: z.string().trim().max(30).optional(),
    company: z.string().trim().min(1).max(120).optional(),
    orgType: z.enum(ORG_TYPES).optional(),
    country: z.string().regex(/^[A-Za-z]{2}$/, "ISO 3166-1 alpha-2").transform((s) => s.toUpperCase()).optional(),
    role: z.enum(["owner", "manager", "employee", "other"]).optional(),
    pain: z.string().trim().max(1000).optional(),
    requirements: LeadRequirementsSchema.optional(),
    // Question ids the visitor declined to answer (qualification engine).
    skippedQuestions: z.array(z.string().max(40)).max(20).optional(),
    consentContact: z.boolean().optional(),
});
type Input = z.infer<typeof CaptureLeadSchema>;

type LeadDraft = Omit<Input, "requirements" | "skippedQuestions"> & { consentAt?: string };
type Stored = { session: QualificationSession; lead: LeadDraft };

function readStored(raw: unknown): Stored {
    const r = (raw && typeof raw === "object" ? raw : {}) as { lead?: LeadDraft };
    return { session: readSession(raw), lead: r.lead && typeof r.lead === "object" ? r.lead : {} };
}

function validateContactFields(input: Input): { field: string; reason: string } | null {
    if (input.email !== undefined && (!isValidEmail(input.email) || isBlockedEmailDomain(input.email))) {
        return { field: "email", reason: "invalid_email" };
    }
    if (input.phone !== undefined && !normalizePhone(input.phone)) return { field: "phone", reason: "invalid_phone" };
    if (input.whatsapp !== undefined && !normalizePhone(input.whatsapp)) return { field: "whatsapp", reason: "invalid_phone" };
    return null;
}

export async function captureLead(ctx: ToolContext, input: Input) {
    const bad = validateContactFields(input);
    if (bad) {
        return fail("validation_failed", `${bad.reason}: ask the visitor for a correct ${bad.field}. Nothing was saved.`, bad);
    }

    const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId } });
    if (!conv) return fail("not_found", "Conversation not found.");
    const stored = readStored(conv.qualification);

    // Merge the lead draft (latest answer wins).
    const { requirements: reqPatch = {}, skippedQuestions = [], ...fields } = input;
    const lead: LeadDraft = { ...stored.lead };
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) (lead as Record<string, unknown>)[k] = v;
    if (lead.phone) lead.phone = normalizePhone(lead.phone) ?? lead.phone;
    if (lead.whatsapp) lead.whatsapp = normalizePhone(lead.whatsapp) ?? lead.whatsapp;
    if (input.consentContact !== undefined) lead.consentAt = ctx.now.toISOString();

    // Top-level orgType / country also feed the requirements.
    const patch = { ...reqPatch, ...(input.orgType ? { orgType: input.orgType } : {}), ...(input.country ? { country: input.country } : {}) };
    const projectType = patch.projectType ?? stored.session.requirements.projectType;
    const service = serviceForProjectType(projectType) ?? stored.session.service;
    const script = service ? ctx.config.qualificationScripts[service] : null;
    const session = applyAnswers(stored.session, script, service, patch, skippedQuestions);
    const nq = script ? nextQuestion(script, session) : null;
    const next = nq ? { id: nq.id, text: ctx.locale === "ar" ? nq.ar : nq.en } : null;

    const contactable = !!lead.name && !!(lead.phone || lead.email || lead.whatsapp);
    const qualification = { ...session, lead } as unknown as object;
    if (!contactable) {
        await prisma.conversation.update({ where: { id: conv.id }, data: { qualification } });
        const missing = [!lead.name && "name", !(lead.phone || lead.email || lead.whatsapp) && "phone or email or whatsapp"].filter(Boolean);
        return ok({ saved: false, missing, nextQuestion: next, qualificationComplete: session.completed });
    }

    const req = session.requirements;
    const contactService = contactServiceFor(service);
    const budget = budgetBand(req.budgetMinUsd ?? req.budgetMaxUsd);
    const base = {
        name: lead.name!,
        email: lead.email ?? "",
        phone: lead.phone ?? lead.whatsapp ?? null,
        whatsapp: lead.whatsapp ?? null,
        company: lead.company ?? null,
        orgType: req.orgType ?? lead.orgType ?? null,
        country: (req.country ?? lead.country)?.toLowerCase() ?? null,
        service: contactService ?? null,
        budget: budget ?? null,
        timeline: req.timeline ?? null,
        role: lead.role ?? null,
        pain: lead.pain ?? null,
        requirements: req as object,
        consentContact: lead.consentContact ?? null,
        consentAt: lead.consentAt ? new Date(lead.consentAt) : null,
    };
    // v1 stage keeps the CRM pipeline meaning; v2 score/tier per §13.11.
    const { stage } = computeLeadScore({
        email: base.email, phone: base.phone ?? undefined, role: base.role ?? undefined, service: base.service ?? undefined,
        budget: base.budget ?? undefined, timeline: base.timeline ?? undefined, pain: base.pain ?? undefined,
    });
    const sf = scoreFields({ ...base, requirements: req }, ctx.config.scoring, ctx.config.version, ctx.now);

    const prev = conv.contactId ? await prisma.contact.findUnique({ where: { id: conv.contactId } }) : null;
    const data = { ...base, ...sf, stage };
    const contact = prev
        ? await prisma.contact.update({ where: { id: prev.id }, data })
        : await prisma.contact.create({
            data: {
                ...data,
                subject: "AI chat",
                message: base.pain || "Lead captured by the AI assistant",
                sourcePage: "chat",
                utmSource: conv.utmSource, utmMedium: conv.utmMedium, utmCampaign: conv.utmCampaign,
                conversationId: conv.id,
            },
        });
    await prisma.conversation.update({ where: { id: conv.id }, data: { qualification, contactId: contact.id } });

    // After the reply: brief on first save / HOT; alerts on transitions only.
    const becameHot = sf.tier === "HOT" && prev?.tier !== "HOT";
    const becameQualified = (stage === "sql" || stage === "opportunity") && !(prev?.stage === "sql" || prev?.stage === "opportunity");
    if (!prev || becameHot || becameQualified) {
        const alertFields: LeadAlertFields = {
            conversationId: conv.id, tier: sf.tier, score: sf.score, stage, country: base.country, service: projectType ?? base.service,
            budget: base.budget, expectedUsers: req.expectedUsers ?? null, mobileApps: req.mobileApps ?? null,
            videoProtection: req.videoProtection ?? null, timeline: base.timeline,
        };
        ctx.afterTurn.push(async () => {
            const brief = await generateBrief(conv.id, ctx.config);
            const f = { ...alertFields, brief: brief?.summary ?? null, nextAction: brief?.nextAction ?? null };
            if (becameHot) await alertHotLead(f);
            else if (becameQualified) await alertQualifiedLead(f);
        });
    }

    return ok({
        saved: true, contactId: contact.id, stage, tier: sf.tier, score: sf.score, breakdown: sf.scoreBreakdown,
        nextQuestion: next, qualificationComplete: session.completed,
    });
}

export const captureLeadTool = defineTool({
    name: "capture_lead",
    description:
        "Save what the visitor told you about themselves and their project. Call it whenever you learn new details (name, phone, email, WhatsApp, company, organisation type, country ISO code, role, pain point, requirements, consent). Pass ONLY what the visitor actually said. Returns the server's next qualification question to ask (phrase it naturally), or a validation error (e.g. invalid_email) — then ask for a correct value.",
    modes: ["sales"],
    writes: true,
    schema: CaptureLeadSchema,
    idempotencyKey: (ctx, _input, toolUseId) => `capture_lead:${ctx.conversationId}:${toolUseId}`,
    run: captureLead,
});
