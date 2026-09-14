// Fan-out admin notifications: Telegram (always, if configured) + email to the
// admin alert list (if SMTP + recipients configured). Best-effort — never throws,
// so it can never break the action it reports on.
import prisma from "@/lib/prismaMysql";
import { notifyTelegram } from "@/lib/telegram";
import { mailerConfigured, sendEmail } from "@/lib/mailer";

const EMAILS_KEY = "admin_alert_emails";
const WHATSAPP_KEY = "support_whatsapp";

async function setting(key: string, envKey: string): Promise<string> {
    let v = "";
    try {
        const row = await prisma.platformSetting.findUnique({ where: { key } });
        v = row?.value ?? "";
    } catch { /* ignore */ }
    if (v.trim() === "") v = process.env[envKey] ?? "";
    return v.trim();
}

/** Comma/space/semicolon-separated admin recipients. PlatformSetting → env. */
export async function adminAlertEmails(): Promise<string[]> {
    const raw = await setting(EMAILS_KEY, "ADMIN_ALERT_EMAILS");
    return raw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
}

/** The public support WhatsApp shown to a user who is blocked. PlatformSetting → env. */
export async function supportWhatsapp(): Promise<string> {
    return setting(WHATSAPP_KEY, "SUPPORT_WHATSAPP");
}

/** Send an admin alert to Telegram + email. Best-effort; each channel independent. */
export async function alertAdmins(subject: string, body: string): Promise<void> {
    // Telegram: subject as a bold-ish first line + body.
    try {
        await notifyTelegram(`${subject}\n\n${body}`);
    } catch (e) {
        console.error("[adminAlert] telegram failed", e);
    }
    // Email: only if SMTP configured and we have recipients.
    try {
        if (!mailerConfigured()) return;
        const to = await adminAlertEmails();
        if (!to.length) return;
        const html =
            `<h3 style="margin:0 0 8px">${escapeHtml(subject)}</h3>` +
            `<pre style="font:13px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;margin:0">${escapeHtml(body)}</pre>`;
        await sendEmail({ to: to.join(", "), subject, text: `${subject}\n\n${body}`, html });
    } catch (e) {
        console.error("[adminAlert] email failed", e);
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}
