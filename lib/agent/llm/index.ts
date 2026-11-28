// The one place the runtime gets its model adapter from (NFR-19).
import type { LlmAdapter } from "./adapter";
import { anthropicAdapter } from "./anthropic";

export function getLlm(): LlmAdapter {
    return anthropicAdapter;
}

export type { LlmAdapter, LlmMessage, LlmRequest, LlmResult, LlmToolCall, LlmToolDef } from "./adapter";
export { PROFILE_MODEL, costUsd, estimateCostUsd, type ModelProfile, type TokenUsage } from "./profiles";
