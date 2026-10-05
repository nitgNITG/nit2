// Model profiles (SRS §13.19, NFR-19). Settings store a profile NAME, never a
// model id; the id is mapped here in code. Prices are USD per token, taken from
// Anthropic's pricing table on 2026-10-05 — bump PRICE_TABLE_VERSION when they change.

export const MODEL_PROFILES = ["fast", "standard", "complex"] as const;
export type ModelProfile = (typeof MODEL_PROFILES)[number];

export const PROFILE_MODEL: Record<ModelProfile, string> = {
    fast: "claude-haiku-4-5",
    standard: "claude-sonnet-5-5",
    complex: "claude-opus-5-5",
};

export const PRICE_TABLE_VERSION = "2026-10-05";

type Price = { in: number; out: number; cacheRead: number; cacheWrite: number };
const M = 1_000_000;
// cacheWrite = 5-minute TTL write (1.25× input).
const PRICES: Record<string, Price> = {
    "claude-haiku-4-5": { in: 1 / M, out: 5 / M, cacheRead: 0.1 / M, cacheWrite: 1.25 / M },
    "claude-sonnet-5-5": { in: 2 / M, out: 10 / M, cacheRead: 0.2 / M, cacheWrite: 2.5 / M },
    "claude-opus-5-5": { in: 4 / M, out: 20 / M, cacheRead: 0.2 / M, cacheWrite: 5 / M },
};

export type TokenUsage = {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
};

/** §13.17: cost = in·priceIn + out·priceOut + cacheRead·priceCacheRead + cacheWrite·priceCacheWrite. */
export function costUsd(model: string, u: TokenUsage): number {
    // Unknown model → price it as the most expensive one, so the budget errs safe.
    const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
    return (
        u.inputTokens * p.in +
        u.outputTokens * p.out +
        u.cacheReadTokens * p.cacheRead +
        u.cacheWriteTokens * p.cacheWrite
    );
}

/** Upper-bound estimate reserved before a call: all input uncached + the full output cap. */
export function estimateCostUsd(model: string, inputTokens: number, maxOutputTokens: number): number {
    return costUsd(model, { inputTokens, outputTokens: maxOutputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 });
}
