// WhatsApp account verification (FR-WA5, §13.15). A phone number alone never
// identifies an account: the client gives their account email, gets a 6-digit
// code by email (lib/emailOtp.ts, purpose whatsapp_link) and types it in
// WhatsApp. The code is checked here, before the model, so it never reaches the
// model, the chat history, logs or audit records.
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { createAndSendOtp, verifyOtp } from "@/lib/emailOtp";
import { hit } from "../../security/rate-limit";
import type { Locale } from "../../tools/types";

export const LINK_DAYS = 90;
const PENDING_MS = 15 * 60_000; // a code typed later than this is treated as a normal message
const STARTS_PER_HOUR = 3;

export type Pending = { email: string; at: string };

export function readPending(raw: unknown, now: Date = new Date()): Pending | null {
    const p = raw as Pending | null;
    if (!p?.email || !p.at) return null;
    return now.getTime() - Date.parse(p.at) <= PENDING_MS ? p : null;
}

/** The account this phone is linked to, if the link is still valid. */
export async function activeIdentity(phoneE164: string, now: Date = new Date()): Promise<{ userId: string } | null> {
    const id = await prisma.whatsAppIdentity.findUnique({ where: { phoneE164 } });
    return id && id.expiresAt > now ? { userId: id.userId } : null;
}

/**
 * Send a code if an account has this email. The answer is the same either way,
 * so it never reveals whether an account exists (AC-34.1).
 */
export async function startVerification(input: { conversationId: string; email: string; locale: Locale; now?: Date }): Promise<{ sent: true } | { rateLimited: true }> {
    const now = input.now ?? new Date();
    const { allowed } = await hit(`wa:verify:${input.conversationId}`, STARTS_PER_HOUR, 60 * 60_000, now);
    if (!allowed) return { rateLimited: true };
    const email = input.email.trim().toLowerCase();
    const user = await mysql.user.findUnique({ where: { email }, select: { id: true, name: true } });
    if (user) {
        const r = await createAndSendOtp(email, "whatsapp_link", { name: user.name ?? undefined, locale: input.locale });
        if (!r.ok && r.error !== "cooldown") console.error("[agent] whatsapp code not sent", r.error);
    }
    await prisma.conversation.update({ where: { id: input.conversationId }, data: { verification: { email, at: now.toISOString() } } });
    return { sent: true };
}

/** A message that is just a 6-digit code (spaces allowed), else null. */
export function extractCode(text: string): string | null {
    const digits = text.replace(/[\s-]/g, "");
    return /^\d{6}$/.test(digits) ? digits : null;
}

export type ConfirmOutcome = "verified" | "wrong_code" | "expired";

/** Check a typed code against the pending verification; links the phone on success. */
export async function confirmCode(input: { conversationId: string; phoneE164: string; pending: Pending; code: string; now?: Date }): Promise<ConfirmOutcome> {
    const now = input.now ?? new Date();
    const r = await verifyOtp(input.pending.email, "whatsapp_link", input.code);
    if (!r.ok) {
        if (r.error === "wrong-code") return "wrong_code";
        await prisma.conversation.update({ where: { id: input.conversationId }, data: { verification: {} } });
        return "expired";
    }
    const user = await mysql.user.findUnique({ where: { email: input.pending.email }, select: { id: true } });
    if (!user) return "expired"; // account removed meanwhile
    const expiresAt = new Date(now.getTime() + LINK_DAYS * 86_400_000);
    await prisma.whatsAppIdentity.upsert({
        where: { phoneE164: input.phoneE164 },
        create: { phoneE164: input.phoneE164, userId: user.id, verifiedAt: now, expiresAt },
        update: { userId: user.id, verifiedAt: now, expiresAt },
    });
    await prisma.conversation.update({
        where: { id: input.conversationId },
        data: { verification: {}, userId: user.id, mode: "support" },
    });
    return "verified";
}
