// Incremental parser for the chat stream (server-sent events, §8.2). Chunks can
// split an event anywhere; events are complete only at a blank line.

export type ChatEvent = { event: string; data: any };

export function createSseParser() {
    let buffer = '';
    return {
        /** Feed raw text; returns the events completed by it. Malformed events are skipped. */
        push(chunk: string): ChatEvent[] {
            buffer += chunk.replace(/\r\n/g, '\n');
            const out: ChatEvent[] = [];
            let i: number;
            while ((i = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, i);
                buffer = buffer.slice(i + 2);
                let event = 'message';
                const data: string[] = [];
                for (const line of block.split('\n')) {
                    if (line.startsWith('event:')) event = line.slice(6).trim();
                    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
                }
                if (!data.length) continue;
                try { out.push({ event, data: JSON.parse(data.join('\n')) }); } catch { /* skip */ }
            }
            return out;
        },
    };
}
