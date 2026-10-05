// Tool registry (§13.5, §13.6, §13.13, NFR-2, NFR-21). The model only sees the
// tools for its mode; every call is validated with Zod, permission-checked,
// deduplicated by idempotency key when it writes, and audited (redacted).
import { z } from "zod";
import prisma from "@/prisma/client";
import { redact } from "../security/redaction";
import { getWorkingHours, handoffToHuman } from "./common/handoff";
import { captureLeadTool } from "./sales/captureLead";
import { listPlans, recommendPlan, startCheckout } from "./sales/catalog";
import { getPriceRange, searchKnowledgeTool, searchProjects } from "./sales/knowledge";
import { fail, type Mode, type ToolContext, type ToolDef, type ToolResult } from "./types";

// Fixed order → a stable tool list, so the cached prompt prefix stays valid.
const ALL: ToolDef[] = [
    searchKnowledgeTool, searchProjects, listPlans, recommendPlan, getPriceRange,
    startCheckout, getWorkingHours, captureLeadTool, handoffToHuman,
] as ToolDef[];

export function toolsFor(mode: Mode): ToolDef[] {
    return ALL.filter((t) => t.modes.includes(mode));
}

export function llmToolDefs(mode: Mode) {
    return toolsFor(mode).map((t) => {
        const schema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
        delete schema.$schema;
        return { name: t.name, description: t.description, inputSchema: schema };
    });
}

export function getTool(name: string): ToolDef | undefined {
    return ALL.find((t) => t.name === name);
}

async function audit(ctx: ToolContext, tool: string, input: unknown, result: ToolResult, latencyMs: number) {
    try {
        await prisma.toolAudit.create({
            data: {
                conversationId: ctx.conversationId,
                turnId: ctx.turnId,
                tool,
                argsRedacted: redact(input ?? null) as object,
                authContext: { mode: ctx.mode, channel: ctx.channel, signedIn: !!ctx.userId },
                status: result.ok ? "ok" : "error",
                errorCode: result.ok ? null : result.code,
                latencyMs,
            },
        });
    } catch (e) {
        console.error("[agent] tool audit failed", (e as Error).message);
    }
}

/** Run one model-requested tool call. Never throws: errors become a §13.6 result. */
export async function executeTool(ctx: ToolContext, name: string, rawInput: unknown, toolUseId: string): Promise<ToolResult> {
    const started = Date.now();
    const done = async (result: ToolResult, input: unknown = rawInput) => {
        await audit(ctx, name, input, result, Date.now() - started);
        return result;
    };

    const tool = getTool(name);
    if (!tool || !tool.modes.includes(ctx.mode)) return done(fail("not_authorized", "This tool is not available here."));

    const parsed = tool.schema.safeParse(rawInput ?? {});
    if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");
        return done(fail("invalid_input", `Invalid input — ${issues}`));
    }
    const input = parsed.data;

    let key: string | null = null;
    if (tool.writes) {
        // A person took over meanwhile → the agent may not write any more (AC-12.3).
        const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { status: true } });
        if (conv?.status !== "open") return done(fail("conflict", "A person is handling this conversation now."), input);
        key = tool.idempotencyKey?.(ctx, input, toolUseId) ?? null;
        if (key) {
            const prior = await prisma.idempotencyRecord.findUnique({ where: { key } });
            if (prior) return done(fail("already_exists", "Already done; this is the first result.", prior.resultJson), input);
        }
    }

    let result: ToolResult;
    try {
        result = await tool.run(ctx, input);
    } catch (e) {
        console.error(`[agent] tool ${name} failed`, (e as Error).message);
        result = fail("service_unavailable", "The service is unavailable right now. Offer a person instead.");
    }

    if (key && result.ok) {
        try {
            await prisma.idempotencyRecord.create({ data: { key, tool: name, resultJson: result.data as object } });
        } catch {
            /* a concurrent duplicate already recorded it */
        }
    }
    return done(result, input);
}
