// Chat stream protocol (§8.2, §13.8): meta → (delta | action)* → handoff? → done,
// or error at any point, after which nothing else is sent. Tool names, inputs and
// results are never streamed.

export type StreamEvent =
    | { event: "meta"; data: { conversationId: string; mode: string; status: string } }
    | { event: "delta"; data: { text: string } }
    | { event: "action"; data: { type: "link"; label: string; url: string } }
    | { event: "handoff"; data: { status: string; message: string } }
    | { event: "done"; data: { messageId: string | null } }
    | { event: "error"; data: { code: string; fallback: { whatsapp: string; contactUrl: string } } };

export type Emit = (e: StreamEvent) => void;

export function encodeEvent(e: StreamEvent): string {
    return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/**
 * Wraps a sink and enforces the order: the first event must be meta; nothing
 * after done/error; handoff at most once and only before done.
 */
export function orderedEmitter(sink: (chunk: string) => void): Emit & { closed: () => boolean } {
    let started = false;
    let finished = false;
    let handedOff = false;
    const emit = ((e: StreamEvent) => {
        if (finished) return;
        if (!started) {
            if (e.event !== "meta" && e.event !== "error") throw new Error(`stream must start with meta, got ${e.event}`);
            started = true;
        } else if (e.event === "meta") return;
        if (e.event === "handoff") {
            if (handedOff) return;
            handedOff = true;
        }
        if ((e.event === "delta" || e.event === "action") && handedOff) return;
        if (e.event === "done" || e.event === "error") finished = true;
        sink(encodeEvent(e));
    }) as Emit & { closed: () => boolean };
    emit.closed = () => finished;
    return emit;
}

export function fallbackLinks(whatsapp: string, locale: string) {
    const digits = whatsapp.replace(/\D/g, "");
    return { whatsapp: digits ? `https://wa.me/${digits}` : "", contactUrl: `/${locale}/contact` };
}
