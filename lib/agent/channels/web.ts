// Web chat (E2 — POST /api/agent/chat, §8.2). Validates, rate-limits, resolves
// the visitor session and conversation, then either stores the message for the
// person who owns the conversation, hands tenders straight to a person, or runs
// an agent turn — streaming server-sent events back.
import { z } from "zod";
import prisma from "@/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { budgetLeft, cairoDate, claimBudgetAlert } from "../runtime/budget";
import { getAgentConfig, type AgentConfig } from "../config";
import { alertBudgetReached, alertVisitorWaiting } from "../alerts";
import { apiError, fallbackFor, loadOwnedConversation, OBJECT_ID } from "../http";
import { detectLocale, msg } from "../messages";
import { performHandoff } from "../runtime/handoff";
import { isTenderRequest } from "../runtime/state";
import { orderedEmitter, type Emit } from "../runtime/streaming";
import { runTurn } from "../runtime/turn";
import { DAY_MS, hit, recordBlocked, visitorKey } from "../security/rate-limit";
import { clientIp, ensureSession, hashIp } from "../security/visitor-session";
import type { Locale, Mode } from "../tools/types";

export const MAX_MESSAGE = 2000; // NFR-7

const Utm = z.strictObject({
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
});
export const ChatBodySchema = z.strictObject({
    conversationId: z.string().regex(OBJECT_ID).optional(),
    message: z.string(),
    locale: z.enum(["ar", "en"]),
    page: z.string().max(300).optional(),
    utm: Utm.optional(),
});

const SSE_HEADERS = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
};

/**
 * Mode is decided by the backend from the signed-in user on every request, never
 * by the model (FR-A2, NFR-1): clients get support mode (their own account data),
 * everyone else — visitors and NITG admins trying the widget — gets sales mode.
 */
export function decideMode(user: { role: string } | null): Mode {
    return user?.role === "client" ? "support" : "sales";
}

function sse(run: (emit: Emit) => Promise<void>, setCookie: string | null): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const emit = orderedEmitter((chunk) => {
                try { controller.enqueue(encoder.encode(chunk)); } catch { /* client went away */ }
            });
            try {
                await run(emit);
            } catch (e) {
                console.error("[agent] chat stream failed", (e as Error).message);
            } finally {
                try { controller.close(); } catch { /* already closed */ }
            }
        },
    });
    const headers = new Headers(SSE_HEADERS);
    if (setCookie) headers.append("Set-Cookie", setCookie);
    return new Response(stream, { status: 200, headers });
}

async function notifyStaffThrottled(conversationId: string, cfg: AgentConfig) {
    // At most one "visitor wrote" alert per conversation per 5 minutes.
    const { count } = await hit(`notify:${conversationId}`, 1, 5 * 60_000);
    if (count === 1) await alertVisitorWaiting(conversationId, { email: cfg.notifications.emailOwnerOnReply });
}

export async function handleChat(req: Request): Promise<Response> {
    let body: z.infer<typeof ChatBodySchema>;
    try {
        const parsed = ChatBodySchema.safeParse(await req.json());
        if (!parsed.success) return apiError(400, "invalid_body", "Validation failed.");
        body = parsed.data;
    } catch {
        return apiError(400, "invalid_body", "Body must be JSON.");
    }
    const text = body.message.trim();
    if (!text) return apiError(400, "invalid_body", "Message is empty.");
    if (text.length > MAX_MESSAGE) return apiError(413, "message_too_long", `Messages are limited to ${MAX_MESSAGE} characters.`);
    // The page's language (where the widget runs) vs the language the visitor writes in.
    const pageLocale: Locale = body.locale;

    const cfg: AgentConfig = await getAgentConfig();
    if (!cfg.enabled.web) return apiError(503, "agent_disabled", "The assistant is off.", { fallback: await fallbackFor(pageLocale) });

    const ipHash = hashIp(clientIp(req));
    const abuse = cfg.abuse;
    if (!(await hit(`ip:msg:${ipHash}`, abuse.ipMessagesPerWindow, abuse.ipWindowMinutes * 60_000)).allowed) {
        await recordBlocked("ip_messages", ipHash);
        return apiError(429, "rate_limited", "Too many messages. Please wait a few minutes.");
    }
    // One visitor's daily cap — survives IP changes for accounts and sessions (NFR-6).
    const visitorAllowed = async (v: { userId?: string | null; sessionId?: string | null }) => {
        const ok = (await hit(`visitor:msg:${visitorKey({ ...v, ipHash })}`, abuse.visitorMessagesPerDay, DAY_MS)).allowed;
        if (!ok) await recordBlocked("visitor_daily", ipHash);
        return ok;
    };
    const visitorLimited = () => apiError(429, "rate_limited", "Daily message limit reached. Please try again tomorrow.");

    const user = await getCurrentUser();
    const mode = decideMode(user);

    let conv;
    let setCookie: string | null = null;
    if (body.conversationId) {
        conv = await loadOwnedConversation(req, body.conversationId);
        if (!conv) return apiError(404, "conversation_not_found", "Conversation not found.");
        if (conv.status === "closed") return apiError(409, "conversation_closed", "This conversation is closed. Start a new one.");
        if (!(await visitorAllowed({ userId: user?.id ?? conv.userId, sessionId: conv.sessionId }))) return visitorLimited();
        // Informational only (inbox routing): record who is talking now.
        if (conv.mode !== mode || (user && !conv.userId)) {
            conv = await prisma.conversation.update({ where: { id: conv.id }, data: { mode, ...(user && !conv.userId ? { userId: user.id } : {}) } });
        }
    } else {
        if (!(await hit(`ip:conv:${ipHash}`, abuse.ipNewConversationsPerHour, 60 * 60_000)).allowed) {
            await recordBlocked("ip_new_conversations", ipHash);
            return apiError(429, "rate_limited", "Too many new conversations. Please try again later.");
        }
        const s = await ensureSession(req, { ipHash, userId: user?.id ?? null });
        setCookie = s.setCookie;
        if (!(await visitorAllowed({ userId: user?.id, sessionId: s.sessionId }))) return visitorLimited();
        conv = await prisma.conversation.create({
            data: {
                channel: "web", mode, status: "open", locale: detectLocale(text, pageLocale), userId: user?.id ?? null, sessionId: s.sessionId,
                assignedTo: null, ipHash, sourcePage: body.page ?? null,
                utmSource: body.utm?.source ?? null, utmMedium: body.utm?.medium ?? null, utmCampaign: body.utm?.campaign ?? null,
            },
        });
    }

    // Replies and server texts follow the visitor's language; too short to tell → the
    // conversation's last known language (an Arabic speaker on /en stays Arabic).
    const locale: Locale = detectLocale(text, conv.locale === "ar" || conv.locale === "en" ? conv.locale : pageLocale);

    if (conv.messageCount >= cfg.limits.maxConversationMessages
        || conv.tokensIn + conv.tokensOut >= cfg.limits.maxConversationTokens) {
        return apiError(429, "rate_limited", msg("limitReached", locale));
    }

    const fallback = await fallbackFor(locale);
    const meta = (status: string) => ({ event: "meta" as const, data: { conversationId: conv.id, mode: conv.mode, status } });
    const storeVisitor = () => Promise.all([
        prisma.chatMessage.create({ data: { conversationId: conv.id, role: "visitor", content: text } }),
        prisma.conversation.update({ where: { id: conv.id }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date(), locale } }),
    ]);

    // A person owns it: store, notify, no model call (FR-H3, TS-08).
    if (conv.status === "waiting_human" || conv.status === "human") {
        await storeVisitor();
        await notifyStaffThrottled(conv.id, cfg);
        const status = conv.status;
        return sse(async (emit) => { emit(meta(status)); emit({ event: "done", data: { messageId: null } }); }, setCookie);
    }

    if (!(await budgetLeft(cfg.dailyBudgetUsd))) {
        if (await claimBudgetAlert()) await alertBudgetReached(cairoDate(), cfg.dailyBudgetUsd);
        return apiError(503, "budget_exhausted", "The assistant is resting for today.", { fallback });
    }

    // One turn at a time per conversation (§13.7).
    const now = new Date();
    const lock = await prisma.conversation.updateMany({
        where: { id: conv.id, status: "open", turnLockUntil: { lt: now } },
        data: { turnLockUntil: new Date(now.getTime() + (cfg.limits.turnTimeoutSeconds + 10) * 1000) },
    });
    if (lock.count !== 1) return apiError(409, "conversation_busy", "A reply is still being written.");

    await storeVisitor();
    const convId = conv.id;
    // Release to the epoch, not "now": the next turn needs turnLockUntil < now, and a message
    // arriving in the same millisecond as the release would otherwise be refused as busy.
    const unlock = () => prisma.conversation.update({ where: { id: convId }, data: { turnLockUntil: new Date(0) } }).catch(() => undefined);

    // Tenders / RFPs go to a person before any model call (FR-H5).
    if (isTenderRequest(text)) {
        return sse(async (emit) => {
            try {
                emit(meta("open"));
                const r = await performHandoff({ conversationId: convId, mode, locale, config: cfg, reason: "tender_or_rfp", summary: text.slice(0, 500) });
                const message = r.ok ? msg("tender", locale) + r.nextReply : msg("handoffOpen", locale);
                const saved = await prisma.chatMessage.create({ data: { conversationId: convId, role: "assistant", content: message } });
                emit({ event: "handoff", data: { status: "waiting_human", message } });
                emit({ event: "done", data: { messageId: saved.id } });
            } finally {
                await unlock();
            }
        }, setCookie);
    }

    return sse(async (emit) => {
        try {
            emit(meta("open"));
            await runTurn({ conversationId: convId, mode, locale, page: body.page ?? null, userId: user?.id ?? null, sessionId: conv.sessionId, config: cfg, emit, fallback });
        } catch (e) {
            console.error("[agent] turn crashed", (e as Error).message);
            emit({ event: "error", data: { code: "model_unavailable", fallback } });
        } finally {
            await unlock();
        }
    }, setCookie);
}
