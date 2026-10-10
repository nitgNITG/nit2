// Phase 4 — proactive follow-up (FR-F1–F5, US-22, US-32, E17, E18). The daily job
// DRAFTS messages; nothing is sent until a staff member approves it (FR-F3):
//   • due      — leads whose next follow-up date is today (FR-F1)
//   • checkout — a checkout link given in chat, not paid after N hours (FR-F2)
//   • abandoned — a consented visitor who left a number and did not come back (FR-F4)
// Outreach needs consent (FR-F5): chat / WhatsApp leads must have said yes;
// contact-form leads asked to be contacted. A "no" is never contacted.
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { mailerConfigured, sendEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/spamRules";
import type { AgentConfig } from "./config";
import { recordActivity } from "./crm/activity";
import { sendWaTemplate, sendWaText, WaSendError } from "./channels/whatsapp/cloud";
import { costUsd, estimateCostUsd, getLlm, PROFILE_MODEL } from "./llm";
import { cairoDate, reserve, settle } from "./runtime/budget";
import { zonedToUtc } from "./runtime/hours";
import { redactText } from "./security/redaction";
import type { Locale } from "./tools/types";

export type FollowUpKind = "due" | "checkout" | "abandoned";
export type FollowUpChannel = "whatsapp" | "email";
export type FollowUpMeta = {
    kind: FollowUpKind; channel: FollowUpChannel; to: string; locale: Locale; contactId: string;
    ref?: string; plan?: string; via?: "text" | "template"; sentAt?: string; decidedBy?: string; decidedAt?: string; error?: string;
};

const DAY = 86_400_000;
const LOOKBACK_MS = 6 * DAY; // inside the 7-day idempotency TTL, so a record never outlives its window
const RECENT_CONTACT_MS = 3 * DAY; // no second follow-up to the same lead within 3 days
const MAX_TEXT = 600;
const CHAT_SOURCES = ["chat", "whatsapp"];

type Contact = NonNullable<Awaited<ReturnType<typeof prisma.contact.findUnique>>>;
type Conv = NonNullable<Awaited<ReturnType<typeof prisma.conversation.findUnique>>>;

// ---- who may be contacted, and where ----

/** E.164 for a lead's number; Egyptian local numbers (01xxxxxxxxx) are completed. */
export function toE164Phone(raw: string | null | undefined, country?: string | null): string | null {
    if (!raw) return null;
    const t = raw.trim().replace(/[\s\-().]/g, "");
    if (/^\+\d{8,15}$/.test(t)) return t;
    if (/^00\d{8,15}$/.test(t)) return `+${t.slice(2)}`;
    if (/^01\d{9}$/.test(t) && (!country || country.toLowerCase() === "eg")) return `+20${t.slice(1)}`;
    return null;
}

/** FR-F5: chat leads need an explicit yes; form leads asked to be contacted; a "no" is final. */
export function mayContact(c: Pick<Contact, "consentContact" | "sourcePage">): boolean {
    if (c.consentContact === false) return false;
    if (CHAT_SOURCES.includes(c.sourcePage ?? "")) return c.consentContact === true;
    return true;
}

/** WhatsApp first (the number the customer used, else the one they gave), else email. */
export function followUpTarget(c: Contact, conv: Pick<Conv, "channel" | "phoneE164"> | null, opts: { phoneOnly?: boolean } = {}): { channel: FollowUpChannel; to: string } | null {
    const wa = (conv?.channel === "whatsapp" ? conv.phoneE164 : null) ?? toE164Phone(c.whatsapp, c.country) ?? toE164Phone(c.phone, c.country);
    if (wa) return { channel: "whatsapp", to: wa };
    if (opts.phoneOnly) return null;
    return c.email && isValidEmail(c.email) ? { channel: "email", to: c.email.trim().toLowerCase() } : null;
}

// ---- the draft text ----

const FALLBACK: Record<FollowUpKind, Record<Locale, (p: { plan?: string }) => string>> = {
    due: {
        ar: () => "حبينا نطمن عليك ونتابع معاك طلبك. هل تحب نكمل ونرتب مكالمة قصيرة نوضح فيها التفاصيل؟",
        en: () => "We wanted to follow up on your request. Would you like to continue and set up a short call to go over the details?",
    },
    checkout: {
        ar: (p) => `لاحظنا إنك بدأت الاشتراك${p.plan ? ` في ${p.plan}` : ""} ولم يكتمل الدفع. لو واجهتك أي مشكلة أو عندك سؤال، رد علينا هنا ونساعدك فوراً.`,
        en: (p) => `We noticed you started the checkout${p.plan ? ` for ${p.plan}` : ""} but the payment wasn't completed. If anything got in the way or you have a question, just reply here and we'll help.`,
    },
    abandoned: {
        ar: () => "شكراً لتواصلك معنا عبر المساعد الذكي. هل ما زلت مهتماً؟ يسعدنا نكمل معاك ونجاوب على أي سؤال.",
        en: () => "Thanks for chatting with us through the AI assistant. Are you still interested? We'd be happy to continue and answer any questions.",
    },
};

const PROMPT = `You write short follow-up messages for N.I.T (a software company in Egypt and the Gulf: eLearning platforms, Moodle, apps, e-commerce) to a potential client. A person on the sales team will review your draft before it is sent.
Rules: one short paragraph, at most 450 characters, no line breaks, no greeting with the name (it is added for you), no signature. Plain text only. Friendly and professional. Mention their need in a few words if known. Never state prices, discounts, deadlines or promises. End with one simple question that invites a reply.
Reply with the message text only.`;

async function draftText(input: {
    kind: FollowUpKind; locale: Locale; contact: Contact; plan?: string; conversationId: string; cfg: AgentConfig;
}): Promise<string> {
    const { kind, locale, contact: c, cfg } = input;
    const fallback = FALLBACK[kind][locale]({ plan: input.plan });
    try {
        const facts = [
            `Reason: ${kind === "due" ? "scheduled follow-up" : kind === "checkout" ? `started buying ${input.plan ?? "a plan"} online but did not pay` : "chatted with our AI assistant and did not come back"}`,
            c.service ? `Service: ${c.service}` : null,
            c.company ? `Company: ${c.company}` : null,
            c.pain ? `Need: ${redactText(c.pain).slice(0, 300)}` : null,
            c.aiSummary ? `Earlier summary: ${redactText(c.aiSummary).slice(0, 500)}` : null,
            `Write in ${locale === "ar" ? "Arabic (Egyptian-friendly, polite)" : "English"}.`,
        ].filter(Boolean).join("\n");
        const model = PROFILE_MODEL[cfg.modelProfiles.summary];
        const llm = getLlm();
        const req = { model, system: PROMPT, messages: [{ role: "user" as const, text: facts }], maxTokens: 300 };
        const r = await reserve(estimateCostUsd(model, llm.estimateInputTokens({ ...req, tools: [] }), req.maxTokens), cfg.dailyBudgetUsd);
        if (!r) return fallback;
        let res;
        try {
            res = await llm.complete(req);
        } finally {
            await settle(r, res ? costUsd(res.model, res.usage) : 0, res?.usage, res && { kind: "followup", model: res.model, conversationId: input.conversationId });
        }
        const text = res.text.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "");
        return text.length >= 20 ? text.slice(0, MAX_TEXT) : fallback;
    } catch (e) {
        console.error("[agent] follow-up draft text failed", (e as Error).message);
        return fallback;
    }
}

const greeting = (name: string, locale: Locale) => {
    const first = name.trim().split(/\s+/)[0] || "";
    return locale === "ar" ? `مرحباً${first ? ` ${first}` : ""}،` : `Hi${first ? ` ${first}` : ""},`;
};

// ---- creating drafts (daily job) ----

async function claim(key: string): Promise<boolean> {
    try {
        await prisma.idempotencyRecord.create({ data: { key, tool: "followup_draft", resultJson: {} } });
        return true;
    } catch {
        return false;
    }
}

/** Skip a lead that already has a draft waiting, or got a follow-up in the last 3 days. */
async function busyLead(contactId: string, now: Date): Promise<boolean> {
    const rows = await prisma.chatMessage.findMany({
        where: { status: { in: ["draft", "sent"] }, createdAt: { gt: new Date(now.getTime() - 30 * DAY) }, followup: { isSet: true } },
        select: { status: true, followup: true, createdAt: true },
        take: 500,
    });
    return rows.some((r) => {
        const f = r.followup as FollowUpMeta | null;
        if (f?.contactId !== contactId) return false;
        if (r.status === "draft") return true;
        return !!f.sentAt && now.getTime() - Date.parse(f.sentAt) < RECENT_CONTACT_MS;
    });
}

/** The conversation a draft belongs to: the given one, the lead's latest, or a new outreach thread. */
async function threadFor(c: Contact, conv: Conv | null, target: { channel: FollowUpChannel; to: string }, locale: Locale): Promise<Conv> {
    if (conv) return conv;
    const linked = c.conversationId ? await prisma.conversation.findUnique({ where: { id: c.conversationId } }) : null;
    if (linked) return linked;
    const latest = await prisma.conversation.findFirst({ where: { contactId: c.id }, orderBy: { lastMessageAt: "desc" } });
    if (latest) return latest;
    return prisma.conversation.create({
        data: {
            channel: target.channel, mode: "sales", status: "closed", locale, contactId: c.id, userId: null, sessionId: null, assignedTo: null,
            phoneE164: target.channel === "whatsapp" ? target.to : null, sourcePage: "follow-up", summary: "Follow-up outreach (drafted by the AI, sent after approval)",
        },
    });
}

async function createDraft(input: {
    kind: FollowUpKind; contact: Contact; conv: Conv | null; target: { channel: FollowUpChannel; to: string }; ref: string; plan?: string; cfg: AgentConfig;
}): Promise<boolean> {
    const { contact: c, target } = input;
    const locale: Locale = input.conv?.locale === "en" || (!input.conv && /^[\x00-\x7F\s]*$/.test(c.name) && c.country !== "eg") ? "en" : "ar";
    const thread = await threadFor(c, input.conv, target, locale);
    const body = await draftText({ kind: input.kind, locale, contact: c, plan: input.plan, conversationId: thread.id, cfg: input.cfg });
    const meta: FollowUpMeta = { kind: input.kind, channel: target.channel, to: target.to, locale, contactId: c.id, ref: input.ref, ...(input.plan ? { plan: input.plan } : {}) };
    await prisma.chatMessage.create({
        data: { conversationId: thread.id, role: "assistant", status: "draft", content: `${greeting(c.name, locale)} ${body}`, followup: meta },
    });
    return true;
}

export type DraftRunResult = { due: number; checkout: number; abandoned: number; skipped: number };

export async function createFollowUpDrafts(cfg: AgentConfig, now: Date = new Date()): Promise<DraftRunResult> {
    const f = cfg.followups;
    const out: DraftRunResult = { due: 0, checkout: 0, abandoned: 0, skipped: 0 };
    const room = () => out.due + out.checkout + out.abandoned < f.maxPerRun;

    // FR-F1 — follow-up date is today (Cairo).
    if (f.dueLeads) {
        const [y, m, d] = cairoDate(now).split("-").map(Number);
        const start = zonedToUtc(y, m, d, 0, 0, "Africa/Cairo");
        const leads = await prisma.contact.findMany({
            where: { nextFollowUpAt: { gte: start, lt: new Date(start.getTime() + DAY) }, status: { notIn: ["won", "lost"] } },
            take: 500,
        });
        for (const c of leads) {
            if (!room()) break;
            const target = mayContact(c) ? followUpTarget(c, null) : null;
            if (!target || (await busyLead(c.id, now)) || !(await claim(`followup:due:${c.id}:${cairoDate(now)}`))) { out.skipped++; continue; }
            if (await createDraft({ kind: "due", contact: c, conv: null, target, ref: cairoDate(now), cfg })) out.due++;
        }
    }

    // FR-F2 — a checkout link from chat, not paid after N hours.
    if (f.unpaidCheckouts) {
        const audits = await prisma.toolAudit.findMany({
            where: { tool: "start_checkout", status: "ok", createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lt: new Date(now.getTime() - f.checkoutAfterHours * 3600_000) } },
            orderBy: { createdAt: "asc" },
            take: 500,
        });
        for (const a of audits) {
            if (!room()) break;
            const conv = await prisma.conversation.findUnique({ where: { id: a.conversationId } });
            const c = conv?.contactId ? await prisma.contact.findUnique({ where: { id: conv.contactId } }) : null;
            if (!conv || !c || !mayContact(c) || ["won", "lost"].includes(c.status)) { out.skipped++; continue; }
            // Paid since? By the signed-in account, or an account with the lead's email.
            const users = [conv.userId, ...(c.email ? (await mysql.user.findMany({ where: { email: c.email.trim().toLowerCase() }, select: { id: true } })).map((u) => u.id) : [])].filter((x): x is string => !!x);
            const paid = users.length ? await mysql.payment.findFirst({ where: { userId: { in: users }, status: "paid", createdAt: { gte: a.createdAt } } }) : null;
            const target = followUpTarget(c, conv);
            if (paid || !target || (await busyLead(c.id, now)) || !(await claim(`followup:checkout:${conv.id}`))) { out.skipped++; continue; }
            const args = (a.argsRedacted ?? {}) as { product?: string; tier?: string };
            const plan = args.tier ? `${args.product === "store" ? "store" : "academy"} ${args.tier}` : undefined;
            if (await createDraft({ kind: "checkout", contact: c, conv, target, ref: a.id, plan, cfg })) out.checkout++;
        }
    }

    // FR-F4 — consented visitor with a number who did not come back.
    if (f.abandoned) {
        const convs = await prisma.conversation.findMany({
            where: {
                contactId: { isSet: true, not: null }, channel: { in: ["web", "whatsapp"] },
                lastMessageAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lt: new Date(now.getTime() - f.abandonedAfterHours * 3600_000) },
            },
            orderBy: { lastMessageAt: "asc" },
            take: 500,
        });
        for (const conv of convs) {
            if (!room()) break;
            const c = await prisma.contact.findUnique({ where: { id: conv.contactId! } });
            // A person already handled it, or the lead was already contacted / closed.
            const staffInvolved = conv.assignedTo || (await prisma.chatMessage.findFirst({ where: { conversationId: conv.id, role: "staff" } }));
            if (!c || c.consentContact !== true || staffInvolved || c.status !== "new") { out.skipped++; continue; }
            const target = followUpTarget(c, conv, { phoneOnly: true }); // FR-F4: a phone or WhatsApp number
            if (!target || (await busyLead(c.id, now)) || !(await claim(`followup:abandoned:${conv.id}`))) { out.skipped++; continue; }
            if (await createDraft({ kind: "abandoned", contact: c, conv, target, ref: conv.id, cfg })) out.abandoned++;
        }
    }
    return out;
}

// ---- approve & send / discard (E17) ----

export type DecideResult =
    | { ok: true; message: unknown }
    | { ok: false; status: number; code: string; message: string };

const fail = (status: number, code: string, message: string): DecideResult => ({ ok: false, status, code, message });

async function whatsappWindowOpen(conversationId: string, now: Date): Promise<boolean> {
    const last = await prisma.chatMessage.findFirst({ where: { conversationId, role: "visitor" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return !!last && now.getTime() - last.createdAt.getTime() < DAY;
}

export async function decideDraft(input: {
    messageId: string; action: "send" | "discard"; content?: string; staffId: string; cfg: AgentConfig; now?: Date;
}): Promise<DecideResult> {
    const now = input.now ?? new Date();
    const msg = /^[a-f0-9]{24}$/.test(input.messageId) ? await prisma.chatMessage.findUnique({ where: { id: input.messageId } }) : null;
    if (!msg || !msg.followup) return fail(404, "not_found", "Draft not found.");
    if (msg.status !== "draft") return fail(409, "not_a_draft", "This message is not a draft (already sent or discarded).");
    const meta = msg.followup as FollowUpMeta;

    // One decision wins, even with two people clicking at once.
    const claimed = await prisma.chatMessage.updateMany({ where: { id: msg.id, status: "draft" }, data: { status: input.action === "send" ? "sending" : "discarded" } });
    if (claimed.count !== 1) return fail(409, "not_a_draft", "Someone else already handled this draft.");
    const decided = { decidedBy: input.staffId, decidedAt: now.toISOString() };

    if (input.action === "discard") {
        const row = await prisma.chatMessage.update({ where: { id: msg.id }, data: { followup: { ...meta, ...decided }, staffId: input.staffId } });
        return { ok: true, message: row };
    }

    const restore = (error: string) => prisma.chatMessage.update({ where: { id: msg.id }, data: { status: "draft", followup: { ...meta, error } } });
    const content = (input.content ?? msg.content).trim();
    if (!content || content.length > 1000) { await restore("empty or too long"); return fail(400, "invalid_body", "The message must be 1–1000 characters."); }

    // Consent can change after drafting (FR-F5).
    const contact = await prisma.contact.findUnique({ where: { id: meta.contactId } });
    if (!contact || !mayContact(contact)) { await restore("no consent"); return fail(409, "no_consent", "This lead has not agreed to be contacted."); }

    let via: "text" | "template" = "text";
    try {
        if (meta.channel === "whatsapp") {
            if (await whatsappWindowOpen(msg.conversationId, now)) {
                await sendWaText(meta.to, content);
            } else {
                const t = input.cfg.followups.whatsappTemplate;
                if (!t.name) { await restore("no template"); return fail(409, "template_missing", "Set the approved WhatsApp template in AI Settings → Follow-ups first."); }
                via = "template";
                // Template body: {{1}} = name, {{2}} = the message (the greeting is the template's).
                const text = content.replace(/^(مرحباً|Hi)[^,،]{0,40}[,،]\s*/, "");
                await sendWaTemplate(meta.to, t.name, meta.locale === "ar" ? t.languageAr : t.languageEn, null, [contact.name.split(/\s+/)[0] || contact.name, text]);
            }
        } else {
            if (!mailerConfigured()) { await restore("smtp off"); return fail(409, "email_unavailable", "Email is not set up on the server (SMTP)."); }
            const subject = meta.locale === "ar" ? "متابعة من فريق N.I.T" : "Following up — N.I.T";
            const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!);
            await sendEmail({
                to: meta.to, subject, text: `${content}\n\n— N.I.T`,
                html: `<div dir="${meta.locale === "ar" ? "rtl" : "ltr"}" style="font:15px/1.7 system-ui,sans-serif">${esc(content)}<p style="color:#666">— N.I.T</p></div>`,
            });
        }
    } catch (e) {
        const error = e instanceof WaSendError ? e.message : (e as Error).message;
        await restore(error);
        return fail(502, "send_failed", `Not sent: ${error}`);
    }

    const row = await prisma.chatMessage.update({
        where: { id: msg.id },
        data: { status: "sent", content, staffId: input.staffId, followup: { ...meta, ...decided, via, sentAt: now.toISOString() } },
    });
    if (contact.status === "new") await prisma.contact.update({ where: { id: contact.id }, data: { status: "contacted" } });
    await recordActivity({ event: "AI_FOLLOWUP_APPROVED", conversationId: msg.conversationId, createdBy: input.staffId, summary: `${meta.kind} follow-up sent by ${meta.channel}${via === "template" ? " (template)" : ""}` });
    return { ok: true, message: row };
}

// ---- listing (Follow-ups page) ----

export async function listFollowUps(status: "draft" | "sent" | "discarded", take = 100) {
    const rows = await prisma.chatMessage.findMany({
        where: { status, followup: { isSet: true } }, orderBy: { createdAt: "desc" }, take,
    });
    const metas = rows.map((r) => r.followup as FollowUpMeta);
    const contacts = metas.length ? await prisma.contact.findMany({ where: { id: { in: Array.from(new Set(metas.map((m) => m.contactId))) } }, select: { id: true, name: true, tier: true, score: true, status: true, consentContact: true } }) : [];
    const convs = rows.length ? await prisma.conversation.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.conversationId))) } }, select: { id: true, channel: true } }) : [];
    return rows.map((r, i) => ({
        id: r.id, status: r.status, content: r.content, createdAt: r.createdAt, conversationId: r.conversationId,
        followup: metas[i], contact: contacts.find((c) => c.id === metas[i].contactId) ?? null,
        conversationChannel: convs.find((c) => c.id === r.conversationId)?.channel ?? null,
    }));
}

export async function countDrafts(): Promise<number> {
    return prisma.chatMessage.count({ where: { status: "draft", followup: { isSet: true } } });
}
