// Conversation state machine (§13.9). Every transition is a single conditional
// update (status ∈ from) that bumps stateVersion, so concurrent actors can't both
// win. The agent can never move a conversation out of waiting_human or human.
import prisma from "@/prisma/client";

export type Status = "open" | "waiting_human" | "human" | "closed";

/** Conditional status change; true when this caller won. */
export async function transition(
    conversationId: string,
    from: Status[],
    to: Status,
    extra: Record<string, unknown> = {},
    where: Record<string, unknown> = {},
): Promise<boolean> {
    const res = await prisma.conversation.updateMany({
        where: { id: conversationId, status: { in: from }, ...where },
        data: { status: to, stateVersion: { increment: 1 }, ...extra },
    });
    return res.count === 1;
}

/** E8: single winner — only while nobody is assigned. */
export function takeOver(conversationId: string, staffId: string): Promise<boolean> {
    return transition(conversationId, ["open", "waiting_human"], "human", { assignedTo: staffId }, {
        OR: [{ assignedTo: null }, { assignedTo: { isSet: false } }],
    });
}

/** E9: hand back to the agent — by the assigned staff member, or an admin. */
export function release(conversationId: string, staffId: string, isAdmin: boolean): Promise<boolean> {
    return transition(conversationId, ["human"], "open", { assignedTo: null }, isAdmin ? {} : { assignedTo: staffId });
}

// FR-H5: tenders / RFPs always go to a person — checked BEFORE the model runs.
const TENDER = [
    /\btenders?\b/i, /\brfp\b/i, /\brfi\b/i, /\brequest for (a )?(formal )?proposal/i,
    /مناقص/, /منافسة/, /كراسة\s*(ال)?شروط/, /طلب\s*عروض/,
];

export function isTenderRequest(text: string): boolean {
    return TENDER.some((re) => re.test(text));
}
