// E15 / E16 — Meta WhatsApp webhook (FR-WA1, NFR-5, TS-26).
// GET: Meta's verification handshake (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
// POST: incoming messages. Unsigned or wrongly signed calls → 401 and nothing
// stored; a message id seen before is ignored; Meta gets 200 at once and the
// agent replies in the background (Meta retries slow webhooks).
import { claimInbound, enqueueInbound } from "@/lib/agent/channels/whatsapp/inbound";
import { getWaConfig, parseWebhook, verifySignature } from "@/lib/agent/channels/whatsapp/cloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const q = new URL(req.url).searchParams;
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (q.get("hub.mode") === "subscribe" && expected && q.get("hub.verify_token") === expected) {
        return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
    const raw = await req.text();
    if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

    const { messages, failedStatuses } = parseWebhook(body);
    for (const s of failedStatuses) console.error("[agent] whatsapp delivery failed", s.id, s.error);
    const cfg = await getWaConfig();
    for (const m of messages) {
        // Only our number (a WhatsApp account can hold several).
        if (cfg?.phoneNumberId && m.phoneNumberId && m.phoneNumberId !== cfg.phoneNumberId) continue;
        if (!(await claimInbound(m.id))) continue;
        void enqueueInbound(m);
    }
    return new Response("OK", { status: 200 });
}
