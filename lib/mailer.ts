// SMTP mailer for site-account emails (verification codes, password resets) — the
// nit2 USER accounts that own academies, NOT academy content (which goes through
// each academy's own Moodle). Modeled on the tawreedatGo backend: nodemailer over
// SMTP, e.g. a Gmail account with an App Password.
//
// Env (server-only):
//   MAIL_HOST   e.g. smtp.gmail.com
//   MAIL_PORT   587 (STARTTLS) or 465 (SSL). Default 587.
//   MAIL_USER   the sending account (e.g. the Gmail address)
//   MAIL_PASS   the account password / Gmail App Password
//   MAIL_FROM   optional display From (defaults to MAIL_USER)

import nodemailer from "nodemailer";

function cfg() {
    return {
        host: (process.env.MAIL_HOST || "").trim(),
        port: Number(process.env.MAIL_PORT || 587) || 587,
        user: (process.env.MAIL_USER || "").trim(),
        pass: process.env.MAIL_PASS || "",
        from: (process.env.MAIL_FROM || process.env.MAIL_USER || "").trim(),
    };
}

/** True only when the SMTP account is configured. */
export function mailerConfigured(): boolean {
    const c = cfg();
    return !!c.host && !!c.user && !!c.pass;
}

function transporter() {
    const c = cfg();
    return nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465, // 465 = implicit TLS; 587 = STARTTLS
        auth: { user: c.user, pass: c.pass },
    });
}

/** Send one email. Throws on transport failure (callers decide how to handle). */
export async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<void> {
    if (!mailerConfigured()) throw new Error("SMTP is not configured (MAIL_HOST/MAIL_USER/MAIL_PASS)");
    const c = cfg();
    await transporter().sendMail({
        from: c.from || c.user,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
    });
}
