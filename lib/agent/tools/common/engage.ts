// open_ticket (FR-P7), send_brochure (FR-S15), request_meeting (FR-S16).
import { z } from "zod";
import prisma from "@/prisma/client";
import mysql from "@/lib/prismaMysql";
import { mailerConfigured, sendEmail } from "@/lib/mailer";
import { alertMeeting, alertTicket } from "../../alerts";
import { cairoDate } from "../../runtime/budget";
import { zonedToUtc } from "../../runtime/hours";
import { defineTool, fail, ok, type ToolContext } from "../types";

export const openTicket = defineTool({
    name: "open_ticket",
    description: "Open a support ticket for the signed-in client when they report a problem you cannot solve (billing, provisioning, technical or other). summary: 1-3 sentences describing the issue. Then tell them the ticket number.",
    modes: ["support"],
    writes: true,
    schema: z.strictObject({
        category: z.enum(["billing", "provisioning", "technical", "other"]),
        summary: z.string().trim().min(5).max(1000),
        tenantSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    }),
    idempotencyKey: (ctx, _i, toolUseId) => `open_ticket:${ctx.conversationId}:${toolUseId}`,
    async run(ctx, { category, summary, tenantSlug }) {
        if (ctx.mode !== "support" || !ctx.userId) return fail("not_authorized", "The visitor must be signed in.");
        if (tenantSlug) {
            const owned = await mysql.tenant.findFirst({ where: { slug: tenantSlug, ownerId: ctx.userId }, select: { slug: true } });
            if (!owned) return fail("not_found", "No academy or store with that name on this account.");
        }
        const t = await prisma.ticket.create({
            data: { conversationId: ctx.conversationId, userId: ctx.userId, tenantSlug: tenantSlug ?? null, category, summary, status: "open" },
        });
        const ticketId = t.id.slice(-6).toUpperCase();
        await alertTicket({ conversationId: ctx.conversationId, ticketId, category, tenantSlug: tenantSlug ?? null, summary });
        return ok({ ticketId });
    },
});

/** Addresses this conversation may email: the signed-in account's own, or one the visitor saved here. */
async function allowedRecipients(ctx: ToolContext): Promise<string[]> {
    const out: string[] = [];
    if (ctx.userId) {
        const u = await mysql.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
        if (u?.email) out.push(u.email.toLowerCase());
    }
    const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { contactId: true, qualification: true } });
    const draft = (conv?.qualification as { lead?: { email?: string } } | null)?.lead?.email;
    if (draft) out.push(draft.toLowerCase());
    if (conv?.contactId) {
        const c = await prisma.contact.findUnique({ where: { id: conv.contactId }, select: { email: true } });
        if (c?.email) out.push(c.email.toLowerCase());
    }
    return out;
}

export const sendBrochure = defineTool({
    name: "send_brochure",
    description: "Share the NITG company profile (kind: company) or a service brochure (kind: service, service: e.g. moodle, ecommerce). Shows a button; also emails it when email is the visitor's saved address (save it with capture_lead first).",
    modes: ["sales", "support"],
    writes: true,
    schema: z.strictObject({
        kind: z.enum(["company", "service"]),
        service: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional(),
        email: z.string().trim().toLowerCase().max(200).optional(),
    }),
    // One send per conversation, brochure and recipient per day (§13.13).
    idempotencyKey: (ctx, i) => `send_brochure:${ctx.conversationId}:${i.kind}:${i.service ?? "-"}:${i.email ?? "-"}:${cairoDate(ctx.now)}`,
    async run(ctx, { kind, service, email }) {
        const b = ctx.config.brochures;
        const url = kind === "company" ? b.company : service ? b.services[service] : undefined;
        if (!url || !/^https:\/\//.test(url)) return fail("not_found", "That brochure is not available; offer a person instead.");
        const ar = ctx.locale === "ar";
        const label = kind === "company" ? (ar ? "ملف الشركة" : "Company profile") : (ar ? "كتيّب الخدمة" : "Service brochure");
        ctx.actions.push({ type: "link", label, url });

        let emailed = false;
        let note: string | undefined;
        if (email) {
            if (!(await allowedRecipients(ctx)).includes(email)) {
                note = "Not emailed: that address is not the visitor's saved email. Save it with capture_lead first.";
            } else if (!mailerConfigured()) {
                note = "Email is not configured; the button is shown instead.";
            } else {
                try {
                    await sendEmail({
                        to: email,
                        subject: ar ? `${label} — N.I.T` : `${label} — N.I.T`,
                        text: `${label}: ${url}`,
                        html: `<p>${label}: <a href="${url}">${url}</a></p>`,
                    });
                    emailed = true;
                } catch {
                    note = "Email could not be sent; the button is shown instead.";
                }
            }
        }
        return ok({ url, emailed, ...(note ? { note } : {}) });
    },
});

export const requestMeeting = defineTool({
    name: "request_meeting",
    description: "Record a meeting request with the sales team: date (YYYY-MM-DD) and time (HH:MM, Cairo time) the visitor prefers, channel call / online / visit, optional notes. Convert relative dates like 'next Tuesday' using the current date. Sales confirms it with the visitor.",
    modes: ["sales", "support"],
    writes: true,
    schema: z.strictObject({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        channel: z.enum(["call", "online", "visit"]),
        notes: z.string().trim().max(500).optional(),
    }),
    idempotencyKey: (ctx, _i, toolUseId) => `request_meeting:${ctx.conversationId}:${toolUseId}`,
    async run(ctx, { date, time, channel, notes }) {
        const [y, m, d] = date.split("-").map(Number);
        const [hh, mm] = time.split(":").map(Number);
        const at = zonedToUtc(y, m, d, hh, mm, "Africa/Cairo");
        if (Number.isNaN(at.getTime()) || new Date(Date.UTC(y, m - 1, d)).getUTCDate() !== d) return fail("validation_failed", "That date does not exist.");
        if (at.getTime() <= ctx.now.getTime()) return fail("validation_failed", "That time is in the past; ask for a future date and time.");
        if (at.getTime() > ctx.now.getTime() + 120 * 86_400_000) return fail("validation_failed", "Please choose a date within the next four months.");
        const conv = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { contactId: true } });
        const row = await prisma.meetingRequest.create({
            data: { contactId: conv?.contactId ?? null, conversationId: ctx.conversationId, preferredAt: at, channel, notes: notes ?? null, status: "requested" },
        });
        await alertMeeting({ conversationId: ctx.conversationId, preferredAt: at, channel });
        const bookingUrl = ctx.config.bookingUrl && /^https:\/\//.test(ctx.config.bookingUrl) ? ctx.config.bookingUrl : undefined;
        if (bookingUrl) ctx.actions.push({ type: "link", label: ctx.locale === "ar" ? "احجز موعدك" : "Book a slot", url: bookingUrl });
        return ok({ meetingId: row.id.slice(-6).toUpperCase(), ...(bookingUrl ? { bookingUrl } : {}) });
    },
});
