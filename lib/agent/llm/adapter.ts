// Provider-neutral model interface (NFR-19). Everything in lib/agent talks to
// this; only llm/anthropic.ts knows the Anthropic SDK. Swap the provider here.
import type { TokenUsage } from "./profiles";

export type LlmToolDef = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>; // JSON Schema
};

export type LlmToolCall = { id: string; name: string; input: unknown };

export type LlmMessage =
    | { role: "user"; text: string }
    // `raw` = the provider's own content for an in-turn assistant message; replayed
    // verbatim inside the same turn (tool loops). Past turns are replayed as text.
    | { role: "assistant"; text: string; raw?: unknown }
    | { role: "tool_results"; results: { id: string; content: string; isError?: boolean }[] };

export type LlmRequest = {
    model: string;
    /** Stable prefix (cached): core knowledge + rules. */
    system: string;
    /** Volatile context after the cache breakpoint: date, page, qualification state. */
    systemVolatile?: string;
    tools: LlmToolDef[];
    messages: LlmMessage[];
    maxTokens: number;
    signal?: AbortSignal;
};

export type LlmStopReason = "end" | "tool_use" | "max_tokens" | "refusal" | "other";

export type LlmResult = {
    text: string;
    toolCalls: LlmToolCall[];
    stopReason: LlmStopReason;
    usage: TokenUsage;
    model: string;
    raw: unknown;
};

export interface LlmAdapter {
    /** Streams text through onText; resolves with the full result. Throws on API/network errors. */
    stream(req: LlmRequest, onText: (delta: string) => void): Promise<LlmResult>;
    /** Non-streaming single call (summaries, briefs, tagging). */
    complete(req: Omit<LlmRequest, "tools">): Promise<LlmResult>;
    /** Rough input-token count for budgeting (no network). */
    estimateInputTokens(req: Pick<LlmRequest, "system" | "systemVolatile" | "tools" | "messages">): number;
}
