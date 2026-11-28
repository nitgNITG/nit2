import prisma from "@/prisma/client";
import { parseLeadEvent, readCappedBody } from "@/lib/leadEvents";

// First-party lead tracking (WhatsApp / phone clicks, contact & quote submits),
// sent by lib/leadTracking.ts with navigator.sendBeacon. Stores no personal data.
// Tracking must never break the site: a DB (or any unexpected) failure still
// answers 204, and is logged.
export const dynamic = "force-dynamic";

const empty = (status: number) => new Response(null, { status });

export async function POST(req: Request) {
    try {
        const text = await readCappedBody(req);
        if (text === null) return empty(413);
        let raw: unknown;
        try {
            raw = JSON.parse(text);
        } catch {
            return empty(400);
        }
        const event = parseLeadEvent(raw);
        if (!event) return empty(400);
        await prisma.leadEvent.create({ data: event });
        return empty(204);
    } catch (error) {
        console.error("[track] lead event not stored:", (error as Error)?.message);
        return empty(204);
    }
}
