// Per-turn log line and error-burst alert (NFR-16): 5 errors in 10 minutes → Telegram.
import { alertErrorBurst } from "../alerts";
import { hit } from "../security/rate-limit";

export type TurnLog = {
    conversationId: string;
    mode: string;
    model: string | null;
    tokensIn: number;
    tokensOut: number;
    tools: string[];
    latencyMs: number;
    error: string | null;
};

export function logTurn(t: TurnLog): void {
    console.log(`[agent] turn ${JSON.stringify(t)}`);
}

export async function recordError(code: string): Promise<void> {
    try {
        const { count } = await hit("agent:errors", 5, 10 * 60_000);
        if (count === 5) await alertErrorBurst(count);
    } catch (e) {
        console.error("[agent] error counter failed", code, (e as Error).message);
    }
}
