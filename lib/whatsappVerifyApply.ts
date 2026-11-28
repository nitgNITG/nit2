import prisma from "@/prisma/client";
import { extractVerifyCodes, VERIFY_TTL_MS } from "@/lib/whatsappVerify";

/**
 * Apply contact-form WhatsApp verification codes found in incoming messages.
 * Shared by both webhooks: /api/whatsapp/webhook (verification only) and the AI agent's
 * /api/agent/whatsapp/webhook — a Meta app has ONE webhook URL, so whichever one is
 * configured must verify leads. `from` is digits only (no "+").
 *
 * One conditional update per candidate code: only a still-pending lead, issued within the
 * TTL, can be verified — and only once, because the code is cleared in the same step.
 * Throws on a DB error (callers decide whether Meta should retry).
 */
export async function applyVerifyCodes(messages: { from: string; body: string }[], now: Date = new Date()) {
    let verified = 0;
    let unmatched = 0;
    for (const msg of messages) {
        let hit = false;
        for (const code of extractVerifyCodes(msg.body).slice(0, 5)) {
            const { count } = await prisma.contact.updateMany({
                where: { waCode: code, waStatus: "pending", createdAt: { gte: new Date(now.getTime() - VERIFY_TTL_MS) } },
                data: { waStatus: "verified", waNumber: msg.from, waVerifiedAt: now, waCode: null },
            });
            if (count > 0) { verified += count; hit = true; break; }
        }
        if (!hit) unmatched++;
    }
    return { verified, unmatched };
}
