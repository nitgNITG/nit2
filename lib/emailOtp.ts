// Email one-time codes for account verification + password reset. 6-digit codes,
// stored HASHED (bcrypt), short-lived, rate-limited. Modeled on tawreedatGo's OTP
// flow but self-contained for nit2.

import bcrypt from "bcrypt";
import prisma from "@/lib/prismaMysql";
import { sendEmail, mailerConfigured } from "@/lib/mailer";

export type OtpPurpose = "verify" | "reset";

const CODE_TTL_MIN = Math.max(1, Number(process.env.OTP_TTL_MINUTES ?? 10) || 10);
const RESEND_COOLDOWN_SEC = Math.max(0, Number(process.env.OTP_RESEND_SECONDS ?? 60) || 60);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS ?? 5) || 5);

function generateCode(): string {
    let out = "";
    for (let i = 0; i < 6; i++) out += Math.floor(Math.random() * 10);
    return out;
}

const norm = (email: string) => email.trim().toLowerCase();

/** Create a code, store it hashed, and email it. Enforces a resend cooldown.
 *  Returns { ok } or { ok:false, error } (e.g. cooldown / mailer off). */
export async function createAndSendOtp(
    email: string, purpose: OtpPurpose, opts: { name?: string; locale?: "ar" | "en" },
): Promise<{ ok: boolean; error?: string }> {
    if (!mailerConfigured()) {
        console.error("[emailOtp] SMTP not configured — cannot send code");
        return { ok: false, error: "mailer-not-configured" };
    }
    const e = norm(email);

    // Resend cooldown — block a new code if one was just sent.
    if (RESEND_COOLDOWN_SEC > 0) {
        const recent = await prisma.emailOtp.findFirst({
            where: { email: e, purpose, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000) } },
            orderBy: { createdAt: "desc" }, select: { id: true },
        });
        if (recent) return { ok: false, error: "cooldown" };
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    // Invalidate older un-consumed codes for this (email, purpose), then store the new one.
    await prisma.emailOtp.updateMany({ where: { email: e, purpose, consumed: false }, data: { consumed: true } }).catch(() => {});
    await prisma.emailOtp.create({
        data: { email: e, purpose, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
    });

    const { subject, text, html } = buildEmail(purpose, code, opts.name || "", opts.locale === "en" ? "en" : "ar");
    try {
        await sendEmail({ to: e, subject, text, html });
        return { ok: true };
    } catch (err) {
        console.error("[emailOtp] send failed", err);
        return { ok: false, error: "send-failed" };
    }
}

/** Verify a submitted code for (email, purpose). Consumes it on success; counts
 *  attempts and rejects once MAX_ATTEMPTS is hit. */
export async function verifyOtp(
    email: string, purpose: OtpPurpose, code: string,
): Promise<{ ok: boolean; error?: string }> {
    const e = norm(email);
    const clean = String(code || "").trim();
    if (!/^\d{6}$/.test(clean)) return { ok: false, error: "invalid-code" };

    const row = await prisma.emailOtp.findFirst({
        where: { email: e, purpose, consumed: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
    });
    if (!row) return { ok: false, error: "expired-or-missing" };
    if (row.attempts >= MAX_ATTEMPTS) {
        await prisma.emailOtp.update({ where: { id: row.id }, data: { consumed: true } }).catch(() => {});
        return { ok: false, error: "too-many-attempts" };
    }

    const match = await bcrypt.compare(clean, row.codeHash);
    if (!match) {
        await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } }).catch(() => {});
        return { ok: false, error: "wrong-code" };
    }
    await prisma.emailOtp.update({ where: { id: row.id }, data: { consumed: true } }).catch(() => {});
    return { ok: true };
}

// Bilingual email content for each purpose.
function buildEmail(purpose: OtpPurpose, code: string, name: string, lang: "ar" | "en") {
    const isAR = lang === "ar";
    const title = purpose === "reset"
        ? (isAR ? "إعادة تعيين كلمة المرور" : "Reset your password")
        : (isAR ? "تأكيد بريدك الإلكتروني" : "Verify your email");
    const lead = purpose === "reset"
        ? (isAR ? "رمز إعادة تعيين كلمة المرور الخاص بك هو:" : "Your password reset code is:")
        : (isAR ? "رمز تأكيد حسابك هو:" : "Your verification code is:");
    const subject = isAR ? `${title} — N.I.T` : `${title} — N.I.T`;
    const greet = isAR ? `مرحباً ${name || ""}،` : `Hi ${name || "there"},`;
    const note = isAR
        ? `هذا الرمز صالح لمدة ${CODE_TTL_MIN} دقيقة. إذا لم تطلبه، تجاهل هذه الرسالة.`
        : `This code is valid for ${CODE_TTL_MIN} minutes. If you didn't request it, you can ignore this email.`;
    const text = `${greet}\n${lead} ${code}\n${note}\n\n— NIT`;
    const html = `
  <div dir="${isAR ? "rtl" : "ltr"}" style="font-family:Arial,Helvetica,sans-serif;background:#f5f3ee;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #eee">
      <h2 style="margin:0 0 14px 0;color:#0B2923">${title}</h2>
      <p style="margin:0 0 12px 0;color:#333;line-height:1.7">${greet}<br/>${lead}</p>
      <div style="font-size:30px;letter-spacing:8px;font-weight:800;text-align:center;color:#1E7D67;padding:18px 0;border-radius:12px;background:#1E7D6710;border:1px dashed #1E7D6740">${code}</div>
      <p style="margin:16px 0 0 0;color:#666;font-size:13px;line-height:1.7">${note}</p>
      <p style="margin:18px 0 0 0;color:#0B2923;font-weight:700">— NIT</p>
    </div>
  </div>`.trim();
    return { subject, text, html };
}
