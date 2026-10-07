// WhatsApp channel (phase 3, FR-WA1–WA5, §8.3). One incoming customer message →
// the same agent as the website: one open conversation per number (sales), the
// number linked to a lead, account questions only after email-code verification,
// a person's conversations left to the person. Replies go out through the Cloud
// API; they are always inside the 24-hour window because the customer just wrote.
import prisma from "@/prisma/client";
import { getAgentConfig, type AgentConfig } from "../../config";
import { alertBudgetReached } from "../../alerts";
import { detectLocale, msg } from "../../messages";
import { budgetLeft, cairoDate, claimBudgetAlert } from "../../runtime/budget";
import { performHandoff } from "../../runtime/handoff";
import { recordError } from "../../runtime/monitor";
import { isTenderRequest } from "../../runtime/state";
import { runTurn } from "../../runtime/turn";
import { DAY_MS, hit, recordBlocked } from "../../security/rate-limit";
import type { Locale, Mode } from "../../tools/types";
import { notifyStaffThrottled } from "../web";
import { getWaConfig, markWaRead, sendWaText, type WaInbound } from "./cloud";
import { activeIdentity, confirmCode, extractCode, readPending } from "./identity";

export const MAX_WA_MESSAGE = 2000;
const LOCK_WAIT_MS = 45_000;

/** TS-26: Meta retries webhooks — a message id is handled once. */
export async function claimInbound(messageId: string): Promise<boolean> {
    try {
        await prisma.idempotencyRecord.create({ data: { key: `wa:in:${messageId}`, tool: "whatsapp_inbound", resultJson: {} } });
        return true;
    } catch {
        return false; // unique key exists → already seen
    }
}

// Messages from one number run one after another (they share a conversation).
const chains = new Map<string, Promise<void>>();
export function enqueueInbound(m: WaInbound): Promise<void> {
    const prev = chains.get(m.from) ?? Promise.resolve();
    const next = prev.then(() => processInbound(m)).catch((e) => {
        console.error("[agent] whatsapp message failed", (e as Error).message);
    });
    chains.set(m.from, next);
    void next.finally(() => { if (chains.get(m.from) === next) chains.delete(m.from); });
    return next;
}

/** Resolves when every queued message has been handled (tests, graceful shutdown). */
export function inboundIdle(): Promise<unknown> {
    return Promise.all(Array.from(chains.values()));
}

const BASE = () => (process.env.NEXT_PUBLIC_BASE_URL || "https://www.nitg-eg.com").replace(/\/$/, "");
const absolute = (url: string) => (url.startsWith("/") ? `${BASE()}${url}` : url);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Conv = NonNullable<Awaited<ReturnType<typeof prisma.conversation.findFirst>>>;

async function findOrCreateConversation(m: WaInbound, mode: Mode, userId: string | null, text: string): Promise<Conv> {
    const existing = await prisma.conversation.findFirst({
        where: { channel: "whatsapp", phoneE164: m.from, status: { not: "closed" } },
        orderBy: { lastMessageAt: "desc" },
    });
    if (existing) {
        if (existing.mode !== mode || (existing.userId ?? null) !== userId) {
            return prisma.conversation.update({ where: { id: existing.id }, data: { mode, userId } });
        }
        return existing;
    }
    // FR-WA2: the number's existing lead, so a returning customer isn't asked again.
    const contact = await prisma.contact.findFirst({ where: { OR: [{ whatsapp: m.from }, { phone: m.from }] }, orderBy: { createdAt: "desc" } });
    const lead = contact
        ? { name: contact.name || m.name || undefined, email: contact.email || undefined, whatsapp: m.from }
        : m.name ? { whatsapp: m.from } : null;
    return prisma.conversation.create({
        data: {
            channel: "whatsapp", mode, status: "open", locale: detectLocale(text, "ar"), userId, phoneE164: m.from,
            sessionId: null, assignedTo: null, sourcePage: "whatsapp", contactId: contact?.id ?? null,
            ...(lead ? { qualification: { lead } } : {}),
        },
    });
}

async function saveVisitor(convId: string, content: string, locale: Locale) {
    await prisma.chatMessage.create({ data: { conversationId: convId, role: "visitor", content } });
    await prisma.conversation.update({ where: { id: convId }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date(), locale } });
}

async function saveAssistant(convId: string, content: string) {
    const row = await prisma.chatMessage.create({ data: { conversationId: convId, role: "assistant", content } });
    await prisma.conversation.update({ where: { id: convId }, data: { messageCount: { increment: 1 }, lastMessageAt: new Date() } });
    return row;
}

/** Send a saved reply; a failed send marks the message failed (shown in the inbox). */
async function deliver(phone: string, messageId: string | null, text: string): Promise<boolean> {
    if (!text.trim()) return true;
    try {
        await sendWaText(phone, text);
        return true;
    } catch (e) {
        console.error("[agent] whatsapp send failed", (e as Error).message);
        await recordError("whatsapp_send_failed");
        if (messageId) await prisma.chatMessage.update({ where: { id: messageId }, data: { status: "failed" } }).catch(() => undefined);
        return false;
    }
}

async function reply(conv: Conv, text: string) {
    const saved = await saveAssistant(conv.id, text);
    await deliver(conv.phoneE164!, saved.id, text);
}

async function handOff(conv: Conv, cfg: AgentConfig, locale: Locale, reason: string, summary: string, send: boolean) {
    const r = await performHandoff({ conversationId: conv.id, mode: conv.mode, locale, config: cfg, reason, summary });
    if (send && r.ok) await reply(conv, r.nextReply);
}

/** One line per message so the server log shows what happened (number masked). */
const trace = (m: WaInbound, outcome: string) => console.log(`[agent] whatsapp …${m.from.slice(-4)}: ${outcome}`);

export async function processInbound(m: WaInbound): Promise<void> {
    const cfg = await getAgentConfig();
    const abuse = cfg.abuse;
    const key = `wa:${m.from}`;
    // Same limits as the website, per number instead of per IP / browser.
    if (!(await hit(`ip:msg:${key}`, abuse.ipMessagesPerWindow, abuse.ipWindowMinutes * 60_000)).allowed) {
        await recordBlocked("ip_messages", key);
        return trace(m, "blocked (too many messages in the window)");
    }
    if (!(await hit(`visitor:msg:${key}`, abuse.visitorMessagesPerDay, DAY_MS)).allowed) {
        await recordBlocked("visitor_daily", key);
        return trace(m, "blocked (daily message limit)");
    }

    void markWaRead(m.id, await getWaConfig());
    const text = (m.text ?? "").trim().slice(0, MAX_WA_MESSAGE);
    const identity = await activeIdentity(m.from);
    const mode: Mode = identity ? "support" : "sales";
    let conv = await findOrCreateConversation(m, mode, identity?.userId ?? null, text);
    const locale: Locale = detectLocale(text, conv.locale === "en" ? "en" : "ar");
    const withPerson = conv.status === "waiting_human" || conv.status === "human";

    // Media, stickers, locations…: text only for now.
    if (m.text === null || !text) {
        await saveVisitor(conv.id, `[${m.type}]`, locale);
        if (withPerson) { trace(m, `${m.type} stored for the person handling it`); return notifyStaffThrottled(conv.id, cfg); }
        if (cfg.enabled.whatsapp) await reply(conv, msg("waTextOnly", locale));
        return trace(m, `${m.type} → text-only notice`);
    }

    // FR-WA5: a typed verification code is checked here and never stored or shown to the model.
    const pending = readPending(conv.verification);
    const code = pending ? extractCode(text) : null;
    if (pending && code) {
        await saveVisitor(conv.id, "[verification code]", locale);
        const outcome = await confirmCode({ conversationId: conv.id, phoneE164: m.from, pending, code });
        await reply(conv, msg(outcome === "verified" ? "waVerified" : outcome === "wrong_code" ? "waWrongCode" : "waCodeExpired", locale));
        return trace(m, `verification code → ${outcome}`);
    }

    // A person owns it: store, tell them, no model call (FR-H3).
    if (withPerson) {
        await saveVisitor(conv.id, text, locale);
        trace(m, `stored for the person handling it (${conv.status})`);
        return notifyStaffThrottled(conv.id, cfg);
    }

    // AI off for WhatsApp: the team answers from the inbox.
    if (!cfg.enabled.whatsapp) {
        await saveVisitor(conv.id, text, locale);
        trace(m, "AI answers on WhatsApp is OFF → sent to the AI Inbox, no auto-reply");
        return handOff(conv, cfg, locale, "whatsapp_ai_off", text.slice(0, 500), false);
    }

    if (conv.messageCount >= cfg.limits.maxConversationMessages || conv.tokensIn + conv.tokensOut >= cfg.limits.maxConversationTokens) {
        await saveVisitor(conv.id, text, locale);
        trace(m, "conversation limit reached → handed to the team");
        return handOff(conv, cfg, locale, "conversation_limit", text.slice(0, 500), true);
    }

    if (!(await budgetLeft(cfg.dailyBudgetUsd))) {
        if (await claimBudgetAlert()) await alertBudgetReached(cairoDate(), cfg.dailyBudgetUsd);
        await saveVisitor(conv.id, text, locale);
        trace(m, "daily AI budget used up (or 0) → handed to the team");
        return handOff(conv, cfg, locale, "budget_exhausted", text.slice(0, 500), true);
    }

    // One turn at a time; WhatsApp can't be told "busy", so wait for the running one.
    const deadline = Date.now() + LOCK_WAIT_MS;
    for (;;) {
        const now = new Date();
        const lock = await prisma.conversation.updateMany({
            where: { id: conv.id, status: "open", turnLockUntil: { lt: now } },
            data: { turnLockUntil: new Date(now.getTime() + (cfg.limits.turnTimeoutSeconds + 10) * 1000) },
        });
        if (lock.count === 1) break;
        const live = await prisma.conversation.findUnique({ where: { id: conv.id } });
        if (!live || live.status !== "open" || Date.now() > deadline) {
            await saveVisitor(conv.id, text, locale);
            if (live && live.status !== "open") await notifyStaffThrottled(conv.id, cfg);
            return trace(m, "stored without a reply (another reply was still running)");
        }
        await sleep(1000);
    }
    const unlock = () => prisma.conversation.update({ where: { id: conv.id }, data: { turnLockUntil: new Date(0) } }).catch(() => undefined);

    try {
        await saveVisitor(conv.id, text, locale);
        conv = (await prisma.conversation.findUnique({ where: { id: conv.id } }))!;

        if (isTenderRequest(text)) {
            const r = await performHandoff({ conversationId: conv.id, mode: conv.mode, locale, config: cfg, reason: "tender_or_rfp", summary: text.slice(0, 500) });
            trace(m, "tender / RFP → handed to sales");
            return reply(conv, r.ok ? msg("tender", locale) + r.nextReply : msg("handoffOpen", locale));
        }

        let replyText = "";
        let handoffText = "";
        let messageId: string | null | undefined;
        let failed = false;
        const links: { label: string; url: string }[] = [];
        await runTurn({
            conversationId: conv.id, mode: conv.mode as Mode, channel: "whatsapp", locale, page: null,
            userId: identity?.userId ?? null, sessionId: null, config: cfg,
            fallback: { whatsapp: "", contactUrl: `${BASE()}/${locale}/contact` },
            emit: (ev) => {
                if (ev.event === "delta") replyText += ev.data.text;
                else if (ev.event === "action") links.push(ev.data);
                else if (ev.event === "handoff") handoffText = ev.data.message ?? "";
                else if (ev.event === "done") messageId = ev.data.messageId;
                else if (ev.event === "error") failed = true;
            },
        });

        if (failed) {
            // The model is down or out of budget: a person takes it from here.
            trace(m, "AI model failed → handed to the team (see the error above)");
            return handOff(conv, cfg, locale, "model_unavailable", text.slice(0, 500), true);
        }
        if (!messageId) return trace(m, "reply discarded: a person took over while the AI was writing");
        const body = [replyText.trim() || handoffText, ...links.map((l) => `${l.label}: ${absolute(l.url)}`)].filter(Boolean).join("\n\n");
        const delivered = await deliver(m.from, messageId, body);
        trace(m, delivered ? `AI replied (${conv.mode})` : "AI reply NOT delivered (see 'whatsapp send failed' above)");
    } finally {
        await unlock();
    }
}
