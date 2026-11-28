// start_account_verification (WhatsApp only, FR-WA5, §13.15). The model passes
// the email the client typed; the server decides whether a code is sent and
// answers the same either way. Confirming the code is done by the WhatsApp
// channel before the model runs, so the code never passes through the model.
import { z } from "zod";
import { startVerification } from "../../channels/whatsapp/identity";
import { defineTool, fail, ok } from "../types";

export const startAccountVerification = defineTool({
    name: "start_account_verification",
    description:
        "WhatsApp only. For questions about the client's own academy, store, subscription or payments when the number is not verified yet: ask for the email of their N.I.T account, then call this. Tell them: if that email has an account, a 6-digit code was sent to it — type the code here. Never say whether the account exists.",
    modes: ["sales"],
    channels: ["whatsapp"],
    writes: true,
    schema: z.strictObject({ email: z.email().max(200) }),
    idempotencyKey: (ctx, input, toolUseId) => `start_account_verification:${ctx.conversationId}:${toolUseId}:${input.email.toLowerCase()}`,
    async run(ctx, { email }) {
        const r = await startVerification({ conversationId: ctx.conversationId, email, locale: ctx.locale, now: ctx.now });
        if ("rateLimited" in r) return fail("rate_limited", "Too many verification attempts. Ask them to try again in an hour, or offer a person.");
        return ok({ sent: true, tellClient: "If this email has an N.I.T account, a 6-digit code was sent to it. Type the code here to link this WhatsApp number (valid 90 days)." });
    },
});
