import type { z } from "zod";
import type { AgentConfig } from "../config";

export type Mode = "sales" | "support";
export type Channel = "web" | "whatsapp";
export type Locale = "ar" | "en";

/** §13.6 error codes — nothing else reaches the model. */
export type ToolErrorCode =
    | "invalid_input"
    | "validation_failed"
    | "not_found"
    | "not_authorized"
    | "rate_limited"
    | "budget_exceeded"
    | "conflict"
    | "already_exists"
    | "service_unavailable";

export type Source = { sourceId: string; sourceType: string; title: string; url?: string };

export type ToolResult =
    | { ok: true; data: unknown; sources?: Source[] }
    | { ok: false; code: ToolErrorCode; message: string; data?: unknown };

/** A button the widget shows (FR-W9). URLs are server-built and internal only. */
export type LinkAction = { type: "link"; label: string; url: string };

/**
 * Everything a tool may know about the caller. Built by the backend from the
 * verified request — the model never supplies any of it (A-02, §13.5).
 */
export type ToolContext = {
    conversationId: string;
    turnId: string;
    mode: Mode;
    channel: Channel;
    locale: Locale;
    userId: string | null; // signed-in client (support tools); never from the model
    sessionId: string | null;
    config: AgentConfig;
    now: Date;
    /** Buttons collected during the turn, streamed as `action` events. */
    actions: LinkAction[];
    /** Set by handoff_to_human; the runtime ends the turn with a `handoff` event. */
    handoff: { status: string; message: string } | null;
    /** Work to run after the reply is done (briefs, alerts). Best-effort. */
    afterTurn: Array<() => Promise<void>>;
};

export type ToolDef<S extends z.ZodType = z.ZodType> = {
    name: string;
    description: string;
    modes: Mode[];
    /** Channels it exists on; omitted = every channel. */
    channels?: Channel[];
    schema: S;
    /** Tools that write are refused once a person owns the conversation (§13.5). */
    writes: boolean;
    /** Idempotency key for writing tools (§13.13); null = no dedupe. */
    idempotencyKey?: (ctx: ToolContext, input: z.infer<S>, toolUseId: string) => string | null;
    run: (ctx: ToolContext, input: z.infer<S>) => Promise<ToolResult>;
};

export const ok = (data: unknown, sources?: Source[]): ToolResult => ({ ok: true, data, ...(sources ? { sources } : {}) });
export const fail = (code: ToolErrorCode, message: string, data?: unknown): ToolResult =>
    ({ ok: false, code, message, ...(data !== undefined ? { data } : {}) });

export function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> {
    return def;
}
