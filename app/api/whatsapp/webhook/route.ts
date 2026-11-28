import { NextRequest, NextResponse } from "next/server";
import { whatsappVerifyConfig, isValidSignature } from "@/lib/whatsappVerify";
import { applyVerifyCodes } from "@/lib/whatsappVerifyApply";

// Meta WhatsApp Cloud API webhook — completes the contact form's reverse WhatsApp
// verification (lib/whatsappVerify.ts). Server-to-server: no auth middleware, no
// cookies; every delivery is authenticated by its X-Hub-Signature-256 instead.
// Never log message bodies, codes or phone numbers here.

export const dynamic = "force-dynamic";

/** Subscription handshake: Meta calls GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=… */
export async function GET(req: NextRequest) {
    const cfg = whatsappVerifyConfig();
    const q = new URL(req.url).searchParams;
    const challenge = q.get("hub.challenge") ?? "";
    if (!cfg || q.get("hub.mode") !== "subscribe" || q.get("hub.verify_token") !== cfg.webhookVerifyToken) {
        return new NextResponse("Forbidden", { status: 403 });
    }
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

type TextMessage = { from: string; body: string };

/** Text messages in a Cloud API `messages` payload; anything else (media, statuses, junk) is skipped. */
function textMessages(payload: unknown): TextMessage[] {
    const out: TextMessage[] = [];
    const entries = (payload as { entry?: unknown })?.entry;
    if (!Array.isArray(entries)) return out;
    for (const entry of entries) {
        const changes = (entry as { changes?: unknown })?.changes;
        if (!Array.isArray(changes)) continue;
        for (const change of changes) {
            const messages = (change as { value?: { messages?: unknown } })?.value?.messages;
            if (!Array.isArray(messages)) continue;
            for (const m of messages as { type?: unknown; from?: unknown; text?: { body?: unknown } }[]) {
                if (m?.type !== "text" || typeof m.text?.body !== "string") continue;
                if (typeof m.from !== "string" || !/^\d{6,20}$/.test(m.from)) continue;
                out.push({ from: m.from, body: m.text.body });
            }
        }
    }
    return out;
}

export async function POST(req: NextRequest) {
    const cfg = whatsappVerifyConfig();
    const raw = await req.text();
    if (!cfg || !isValidSignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) {
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    // From here on always 200 — Meta retries anything else for days.
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }, { status: 200 }); }

    let verified = 0;
    let unmatched = 0;
    try {
        ({ verified, unmatched } = await applyVerifyCodes(textMessages(payload)));
    } catch (error) {
        // The one non-200 for a signed payload: a DB outage. Meta's retry then delivers
        // the code again later (the update is conditional, so a retry can't double-apply).
        console.error("[WA verify] update failed:", (error as Error)?.name ?? "error");
        return NextResponse.json({ message: "Temporary error" }, { status: 500 });
    }
    if (verified || unmatched) console.log(`[WA verify] verified=${verified} unmatched=${unmatched}`);
    return NextResponse.json({ ok: true }, { status: 200 });
}
