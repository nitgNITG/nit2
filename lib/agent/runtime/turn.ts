// One turn (FR-A1, FR-A6–A9, §13.7, §13.8): the visitor's message, every model and
// tool call it causes, and the final reply. Limits stop the loop with a safe
// fallback. The reply is saved only if the conversation is still the agent's when
// it finishes — if a person took over meanwhile it is discarded (AC-12.3).
import { randomUUID } from "node:crypto";
import prisma from "@/prisma/client";
import type { AgentConfig } from "../config";
import { buildCorePrompt, buildVolatileContext } from "../knowledge/core";
import { pageTopic } from "../knowledge/sources";
import { getKnowledgeVersion } from "../knowledge/version";
import { costUsd, estimateCostUsd, getLlm, PROFILE_MODEL, type LlmMessage, type TokenUsage } from "../llm";
import { msg } from "../messages";
import { readSession } from "../qualification/engine";
import { redact } from "../security/redaction";
import { executeTool, llmToolDefs } from "../tools/registry";
import type { Locale, Mode, ToolContext } from "../tools/types";
import { reserve, settle } from "./budget";
import { workingHoursStatus } from "./hours";
import { logTurn, recordError } from "./monitor";
import type { Emit } from "./streaming";

export const HISTORY_LIMIT = 30; // NFR-9
const PARAGRAPH = "\n\n";

export type TurnInput = {
    conversationId: string;
    mode: Mode;
    locale: Locale;
    page: string | null;
    userId: string | null;
    sessionId: string | null;
    config: AgentConfig;
    emit: Emit;
    fallback: { whatsapp: string; contactUrl: string };
    now?: Date;
};

export type TurnOutcome = "replied" | "handoff" | "discarded" | "error";

/** Past turns as plain text (visitor → user, assistant/staff → assistant). */
export async function loadHistory(conversationId: string): Promise<LlmMessage[]> {
    const rows = await prisma.chatMessage.findMany({
        where: { conversationId, role: { in: ["visitor", "assistant", "staff"] }, status: "sent" },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
    });
    const msgs: LlmMessage[] = rows.reverse().map((r) =>
        r.role === "visitor"
            ? { role: "user", text: r.content }
            : { role: "assistant", text: r.role === "staff" ? `[NITG team member]: ${r.content}` : r.content },
    );
    while (msgs.length && msgs[0].role !== "user") msgs.shift(); // must start with the visitor
    return msgs;
}

function qualificationLine(raw: unknown, cfg: AgentConfig, locale: Locale): string | null {
    const s = readSession(raw);
    if (!s.service) return null;
    const q = s.currentQuestionId ? cfg.qualificationScripts[s.service].questions.find((x) => x.id === s.currentQuestionId) : null;
    return `service=${s.service}; answered=${s.answered.join(",") || "none"}; ${
        q ? `next question to ask: "${locale === "ar" ? q.ar : q.en}"` : s.completed ? "all questions answered" : "no question pending"
    }`;
}

export async function runTurn(input: TurnInput): Promise<TurnOutcome> {
    const { conversationId, config: cfg, emit, locale, mode } = input;
    const now = input.now ?? new Date();
    const started = Date.now();
    const turnId = randomUUID();
    const limits = cfg.limits;
    const model = PROFILE_MODEL[cfg.modelProfiles.chat];
    const llm = getLlm();
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    const toolsUsed: string[] = [];

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new Error("conversation vanished");
    const startVersion = conv.stateVersion;

    const knowledgeVersion = await getKnowledgeVersion();
    const system = buildCorePrompt(cfg, mode, locale, knowledgeVersion);
    const systemVolatile = buildVolatileContext({
        now, locale, page: input.page ?? conv.sourcePage, topic: pageTopic(input.page ?? conv.sourcePage),
        signedIn: !!input.userId, workingHoursOpen: workingHoursStatus(cfg.workingHours, now).open,
        qualification: qualificationLine(conv.qualification, cfg, locale),
    }) + (conv.summary && conv.messageCount > HISTORY_LIMIT ? `\nEarlier conversation summary: ${conv.summary}` : "");
    const tools = llmToolDefs(mode);
    const messages = await loadHistory(conversationId);

    const ctx: ToolContext = {
        conversationId, turnId, mode, channel: "web", locale, userId: input.userId, sessionId: input.sessionId,
        config: cfg, now, actions: [], handoff: null, afterTurn: [],
    };

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), limits.turnTimeoutSeconds * 1000);
    let reply = "";
    let needSeparator = false;
    let toolCalls = 0;
    let fallbackText: string | null = null;
    let error: string | null = null;
    let lastModel: string | null = null;

    try {
        for (let iter = 0; ; iter++) {
            if (iter >= limits.maxModelIterationsPerTurn) { fallbackText = msg("turnLimit", locale); break; }

            const req = {
                model, system, systemVolatile, tools, messages,
                maxTokens: Math.max(256, limits.maxTurnOutputTokens - usage.outputTokens), signal: abort.signal,
            };
            const estIn = llm.estimateInputTokens(req);
            const usedIn = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
            if (iter > 0 && usedIn + estIn > limits.maxTurnInputTokens) { fallbackText = msg("turnLimit", locale); break; }
            const reservation = await reserve(estimateCostUsd(model, estIn, req.maxTokens), cfg.dailyBudgetUsd, now);
            if (!reservation) { error = "budget_exhausted"; break; }

            let res;
            try {
                res = await llm.stream(req, (delta) => {
                    if (needSeparator) { // text before and after a tool call are separate paragraphs
                        needSeparator = false;
                        reply += PARAGRAPH;
                        emit({ event: "delta", data: { text: PARAGRAPH } });
                    }
                    reply += delta;
                    emit({ event: "delta", data: { text: delta } });
                });
            } finally {
                await settle(reservation, res ? costUsd(res.model, res.usage) : 0, res?.usage);
            }
            lastModel = res.model;
            usage.inputTokens += res.usage.inputTokens;
            usage.outputTokens += res.usage.outputTokens;
            usage.cacheReadTokens += res.usage.cacheReadTokens;
            usage.cacheWriteTokens += res.usage.cacheWriteTokens;

            if (res.stopReason === "refusal") { fallbackText = msg("turnLimit", locale); break; }
            if (!res.toolCalls.length) break; // final answer
            if (res.stopReason === "max_tokens") { fallbackText = msg("turnLimit", locale); break; } // truncated tool input: never run it

            // A person may have taken over while the model was thinking.
            const live = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { status: true, stateVersion: true } });
            if (live?.status !== "open" || live.stateVersion !== startVersion) break;

            const results: { id: string; content: string; isError?: boolean }[] = [];
            let overLimit = false;
            for (const call of res.toolCalls) {
                if (toolCalls >= limits.maxToolCallsPerTurn) { overLimit = true; break; }
                toolCalls++;
                toolsUsed.push(call.name);
                // Sequential on purpose: two capture_lead calls must not race to create two Contacts.
                const r = await executeTool(ctx, call.name, call.input, call.id);
                results.push({ id: call.id, content: JSON.stringify(r), isError: !r.ok || undefined });
                await prisma.chatMessage.create({
                    data: {
                        conversationId, role: "tool", toolName: call.name, toolUseId: call.id, turnId,
                        content: JSON.stringify({ input: redact(call.input), ok: r.ok, code: r.ok ? null : r.code }),
                    },
                });
                if (ctx.handoff) break;
            }
            if (overLimit) { fallbackText = msg("turnLimit", locale); break; }
            if (ctx.handoff) break;
            needSeparator = reply.trim().length > 0;
            messages.push({ role: "assistant", text: res.text, raw: res.raw });
            messages.push({ role: "tool_results", results });
        }
    } catch (e) {
        error = abort.signal.aborted ? "model_timeout" : "model_unavailable";
        console.error("[agent] turn failed", conversationId, (e as Error).message);
    } finally {
        clearTimeout(timer);
    }

    const log = (err: string | null) => logTurn({
        conversationId, mode, model: lastModel, tokensIn: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
        tokensOut: usage.outputTokens, tools: toolsUsed, latencyMs: Date.now() - started, error: err,
    });
    const tokenData = {
        tokensIn: { increment: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens },
        tokensOut: { increment: usage.outputTokens },
    };

    if (error) {
        await prisma.conversation.update({ where: { id: conversationId }, data: tokenData });
        await recordError(error);
        log(error);
        emit({ event: "error", data: { code: error === "budget_exhausted" ? "budget_exhausted" : "model_unavailable", fallback: input.fallback } });
        return "error";
    }

    // Our own handoff bumps stateVersion by exactly one; anything else means a person stepped in.
    const live = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { status: true, stateVersion: true } });
    const expected = startVersion + (ctx.handoff ? 1 : 0);
    if (!live || live.stateVersion !== expected) {
        await prisma.conversation.update({ where: { id: conversationId }, data: tokenData });
        log("discarded_after_takeover");
        emit({ event: "handoff", data: { status: live?.status ?? "human", message: "" } });
        emit({ event: "done", data: { messageId: null } });
        return "discarded";
    }

    let text = reply.trim();
    if (fallbackText) text = text ? `${text}\n\n${fallbackText}` : fallbackText;
    if (ctx.handoff && !text) text = ctx.handoff.message;
    if (fallbackText) emit({ event: "delta", data: { text: (reply.trim() ? "\n\n" : "") + fallbackText } });

    const saved = await prisma.chatMessage.create({
        data: {
            conversationId, role: "assistant", content: text || "…", turnId, model: lastModel,
            tokensIn: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, tokensOut: usage.outputTokens,
            latencyMs: Date.now() - started,
        },
    });
    await prisma.conversation.update({
        where: { id: conversationId },
        data: { ...tokenData, messageCount: { increment: 1 }, lastMessageAt: new Date(), knowledgeVersion },
    });

    const seen = new Set<string>();
    for (const a of ctx.actions) {
        if (seen.has(a.url)) continue;
        seen.add(a.url);
        emit({ event: "action", data: a });
    }
    if (ctx.handoff) emit({ event: "handoff", data: ctx.handoff });
    emit({ event: "done", data: { messageId: saved.id } });
    log(null);

    for (const task of ctx.afterTurn) {
        try { await task(); } catch (e) { console.error("[agent] after-turn task failed", (e as Error).message); }
    }
    return ctx.handoff ? "handoff" : "replied";
}

