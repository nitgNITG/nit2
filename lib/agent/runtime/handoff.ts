// Handoff to a person (FR-H1, FR-H4). Shared by the handoff_to_human tool, the
// visitor's "Talk to a person" button (E4) and the tender keyword check.
import prisma from "@/prisma/client";
import type { AgentConfig } from "../config";
import { alertHandoff } from "../alerts";
import { recordActivity } from "../crm/activity";
import { msg } from "../messages";
import type { Locale } from "../tools/types";
import { formatNextOpen, workingHoursStatus } from "./hours";
import { transition } from "./state";

export function handoffReply(cfg: AgentConfig, locale: Locale, now: Date): string {
    const wh = workingHoursStatus(cfg.workingHours, now);
    if (wh.open || !wh.nextOpenAt) return msg("handoffOpen", locale);
    return msg("handoffClosed", locale, { next: formatNextOpen(wh.nextOpenAt, cfg.workingHours.tz, locale) });
}

export type HandoffOutcome =
    | { ok: true; status: "waiting_human"; nextReply: string }
    | { ok: false; status: string | null };

export async function performHandoff(input: {
    conversationId: string;
    mode: string;
    locale: Locale;
    config: AgentConfig;
    reason: string;
    summary: string;
    now?: Date;
}): Promise<HandoffOutcome> {
    const now = input.now ?? new Date();
    const won = await transition(input.conversationId, ["open"], "waiting_human", {
        summary: input.summary.slice(0, 2000) || undefined,
    });
    if (!won) {
        const c = await prisma.conversation.findUnique({ where: { id: input.conversationId }, select: { status: true } });
        return { ok: false, status: c?.status ?? null };
    }
    const nextReply = handoffReply(input.config, input.locale, now);
    await prisma.chatMessage.create({
        data: { conversationId: input.conversationId, role: "system", content: `handoff: ${input.reason}`.slice(0, 500) },
    });
    await alertHandoff({ conversationId: input.conversationId, reason: input.reason, summary: input.summary, mode: input.mode });
    await recordActivity({ event: "AI_HANDOFF", conversationId: input.conversationId, createdBy: "AI", summary: input.reason });
    return { ok: true, status: "waiting_human", nextReply };
}
