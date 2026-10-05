// Anthropic implementation of the model adapter. The only file that imports the
// SDK. Uses the server-side refusal fallback ("default" routing, beta) so a
// safety-classifier decline is retried on a fallback model inside the same call.
import Anthropic from "@anthropic-ai/sdk";
import type { LlmAdapter, LlmMessage, LlmRequest, LlmResult, LlmStopReason } from "./adapter";

type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
// Models that accept the "default" fallbacks form on the Claude API.
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);
const EFFORT_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5"]);

let client: Anthropic | null = null;
function sdk(): Anthropic {
    // maxRetries 1: the turn has a 30 s budget (FR-A9); the abort signal bounds it.
    client ??= new Anthropic({ maxRetries: 1 });
    return client;
}

function toParams(messages: LlmMessage[]): BetaMessageParam[] {
    return messages.map((m): BetaMessageParam => {
        if (m.role === "user") return { role: "user", content: m.text };
        if (m.role === "assistant") {
            return m.raw
                ? { role: "assistant", content: m.raw as BetaMessageParam["content"] }
                : { role: "assistant", content: m.text || "…" };
        }
        return {
            role: "user",
            content: m.results.map((r) => ({
                type: "tool_result" as const,
                tool_use_id: r.id,
                content: r.content,
                is_error: r.isError || undefined,
            })),
        };
    });
}

function system(req: Pick<LlmRequest, "system" | "systemVolatile">) {
    const blocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
        { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
    ];
    if (req.systemVolatile) blocks.push({ type: "text", text: req.systemVolatile });
    return blocks;
}

function stopReason(r: string | null | undefined): LlmStopReason {
    if (r === "end_turn" || r === "stop_sequence") return "end";
    if (r === "tool_use") return "tool_use";
    if (r === "max_tokens") return "max_tokens";
    if (r === "refusal") return "refusal";
    return "other";
}

function result(msg: BetaMessage): LlmResult {
    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const toolCalls = msg.content
        .filter((b) => b.type === "tool_use")
        .map((b) => {
            const t = b as Anthropic.Beta.Messages.BetaToolUseBlock;
            return { id: t.id, name: t.name, input: t.input };
        });
    return {
        text,
        toolCalls,
        stopReason: stopReason(msg.stop_reason),
        usage: {
            inputTokens: msg.usage.input_tokens ?? 0,
            outputTokens: msg.usage.output_tokens ?? 0,
            cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
        },
        model: msg.model,
        raw: msg.content,
    };
}

function baseParams(req: Omit<LlmRequest, "tools"> & { tools?: LlmRequest["tools"] }) {
    const fallback = FALLBACK_MODELS.has(req.model);
    return {
        model: req.model,
        max_tokens: req.maxTokens,
        system: system(req),
        messages: toParams(req.messages),
        // Chat replies: adaptive thinking at low effort keeps them fast (NFR-10).
        // Haiku 4.5 rejects `effort`, so it only goes to the models that take it.
        ...(EFFORT_MODELS.has(req.model) ? { output_config: { effort: "low" as const } } : {}),
        ...(req.tools?.length
            ? {
                tools: req.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    input_schema: t.inputSchema as Anthropic.Beta.Messages.BetaTool.InputSchema,
                })),
            }
            : {}),
        ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
    };
}

export const anthropicAdapter: LlmAdapter = {
    async stream(req, onText) {
        const stream = sdk().beta.messages.stream(baseParams(req), { signal: req.signal });
        stream.on("text", (delta) => onText(delta));
        return result(await stream.finalMessage());
    },

    async complete(req) {
        const { model, max_tokens, system: sys, messages, betas, fallbacks } = baseParams(req);
        const msg = await sdk().beta.messages.create(
            { model, max_tokens, system: sys, messages, ...(betas ? { betas, fallbacks } : {}) },
            { signal: req.signal },
        );
        return result(msg);
    },

    estimateInputTokens(req) {
        // ~3.5 chars/token for mixed Arabic/English, rounded up. Only used for the
        // budget reservation, which is then settled with the real usage.
        let chars = req.system.length + (req.systemVolatile?.length ?? 0);
        chars += JSON.stringify(req.tools).length;
        for (const m of req.messages) chars += m.role === "tool_results" ? JSON.stringify(m.results).length : m.text.length + (m.role === "assistant" && m.raw ? JSON.stringify(m.raw).length : 0);
        return Math.ceil(chars / 3.5) + 50;
    },
};
