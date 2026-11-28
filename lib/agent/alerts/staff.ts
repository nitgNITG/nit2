// Emails the team members a conversation concerns (FR-H1): on handoff, everyone
// who works that inbox (sales or support permission) plus the admin alert list;
// when the visitor writes again, the staff member who owns the conversation.
// Same rule as the Telegram alerts: business fields and a dashboard link only.
import { Prisma } from "prismamysql";
import mysql from "@/lib/prismaMysql";
import { adminAlertEmails } from "@/lib/adminAlert";
import { mailerConfigured, sendEmail } from "@/lib/mailer";
import { parsePermissions } from "../security/authorization";
import { redactText } from "../security/redaction";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Who works this inbox: the admin alert list + staff holding the mode's permission. */
export async function inboxRecipients(mode: string): Promise<string[]> {
    const perm = mode === "support" ? "support" : "sales";
    const staff = await mysql.user.findMany({
        where: { agentPermissions: { not: Prisma.DbNull } },
        select: { email: true, agentPermissions: true },
        take: 200,
    });
    const emails = [...(await adminAlertEmails()), ...staff.filter((u) => parsePermissions(u.agentPermissions).includes(perm)).map((u) => u.email)];
    return Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))));
}

async function send(to: string[], subject: string, lines: string[], link: string): Promise<number> {
    if (!to.length || !mailerConfigured()) return 0;
    const text = `${lines.join("\n")}\n\nOpen: ${link}`;
    const html =
        lines.map((l) => `<p style="margin:0 0 8px;font:14px/1.5 system-ui,sans-serif">${esc(l)}</p>`).join("") +
        `<p style="margin:16px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#1E7D67;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font:600 14px system-ui,sans-serif">Open the conversation</a></p>`;
    // One email per person: staff don't see each other's addresses.
    const results = await Promise.allSettled(to.map((addr) => sendEmail({ to: addr, subject, text, html })));
    results.forEach((r) => { if (r.status === "rejected") console.error("[agent] staff email failed", (r.reason as Error)?.message); });
    return results.filter((r) => r.status === "fulfilled").length;
}

export async function emailHandoff(input: { mode: string; reason: string; summary: string; link: string }): Promise<number> {
    try {
        if (!mailerConfigured()) return 0;
        const team = input.mode === "support" ? "support" : "sales";
        return await send(await inboxRecipients(input.mode), `🙋 A ${team} conversation needs a person`, [
            `The AI assistant handed a ${team} conversation to the team.`,
            `Reason: ${redactText(input.reason).slice(0, 200)}`,
            `Summary: ${redactText(input.summary).slice(0, 800)}`,
            "Take it over from the AI Inbox.",
        ], input.link);
    } catch (e) {
        console.error("[agent] handoff email failed", (e as Error).message);
        return 0;
    }
}

export async function emailOwnerVisitorWrote(input: { assignedTo: string | null; link: string }): Promise<number> {
    try {
        if (!input.assignedTo || !mailerConfigured()) return 0;
        const owner = await mysql.user.findUnique({ where: { id: input.assignedTo }, select: { email: true } });
        if (!owner?.email) return 0;
        return await send([owner.email], "💬 The visitor replied in your conversation", [
            "A visitor wrote a new message in a conversation you took over.",
        ], input.link);
    } catch (e) {
        console.error("[agent] owner email failed", (e as Error).message);
        return 0;
    }
}
