// handoff_to_human, get_working_hours (FR-H1, FR-H2, FR-H4).
import { z } from "zod";
import { performHandoff } from "../../runtime/handoff";
import { workingHoursStatus } from "../../runtime/hours";
import { defineTool, fail, ok } from "../types";

export const handoffToHuman = defineTool({
    name: "handoff_to_human",
    description:
        "Hand the conversation to an NITG team member. Use when the visitor asks for a person, after two failed answers, on anger / legal / refund topics, for custom quotes without an approved range, and always for tenders or RFPs. summary: 1-3 sentences on what they need.",
    modes: ["sales", "support"],
    writes: true,
    schema: z.strictObject({
        reason: z.string().trim().min(2).max(200),
        summary: z.string().trim().min(2).max(1000),
    }),
    idempotencyKey: (ctx, _input, toolUseId) => `handoff_to_human:${ctx.conversationId}:${toolUseId}`,
    async run(ctx, { reason, summary }) {
        const r = await performHandoff({
            conversationId: ctx.conversationId, mode: ctx.mode, locale: ctx.locale, config: ctx.config, reason, summary, now: ctx.now,
        });
        if (!r.ok) return fail("conflict", "The conversation is already with a person.");
        ctx.handoff = { status: r.status, message: r.nextReply };
        return ok({ status: r.status, nextReply: r.nextReply });
    },
});

export const getWorkingHours = defineTool({
    name: "get_working_hours",
    description: "Whether the NITG team is available now, and when it next opens (ISO time).",
    modes: ["sales", "support"],
    writes: false,
    schema: z.strictObject({}),
    async run(ctx) {
        const s = workingHoursStatus(ctx.config.workingHours, ctx.now);
        return ok({ open: s.open, nextOpenAt: s.nextOpenAt?.toISOString() ?? null, timezone: ctx.config.workingHours.tz });
    },
});
