// Store expiry / suspension e-mails — sent by nit2 (site SMTP, lib/mailer.ts) to
// the store OWNER. Academies get the equivalent from their own Moodle
// (triggerExpiryReminder); stores have no mail path of their own for platform
// billing notices, and the renew action lives on nit2's account page anyway.
//
// Stages mirror the academy loop in /api/cron/expiry: 7 / 3 / 1 days before the
// term ends and once on day 0 (still inside the grace period), each at most once
// per term (Tenant.expiryRemindersSent, re-armed on renewal / plan change).
// `suspended` is sent once when the grace period runs out and the store is locked.

import { sendEmail, mailerConfigured } from "@/lib/mailer";
import { STORE_DOMAIN } from "@/lib/products/store";

/** Days left until the term ends (the wording follows this, not the reminder
 *  stage: a store first seen with 3 days left gets "in 3 days" even though the
 *  bookkeeping marks the 7-day stage) — or "suspended". */
export type StoreExpiryStage = number | "suspended";

export type StoreExpiryMailInput = {
    to: string;
    ownerName?: string | null;
    storeName: string;
    slug: string;
    tier?: string | null;
    validUntil: Date;
    renewUrl: string;
    stage: StoreExpiryStage;
    /** Days the store stays reachable after expiry before it is suspended. */
    graceDays: number;
    /** Days a suspended store is kept before auto-delete (0 = kept indefinitely). */
    autoDeleteDays?: number;
};

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export function buildStoreExpiryEmail(i: StoreExpiryMailInput): { subject: string; text: string; html: string } {
    const url = `https://${i.slug}.${STORE_DOMAIN}`;
    const date = ymd(i.validUntil);
    const name = i.ownerName || i.to.split("@")[0];
    const plan = i.tier ? ` (${i.tier})` : "";

    let subject: string, en: string, ar: string;
    const days = typeof i.stage === "number" ? i.stage : -1;
    if (typeof i.stage === "number" && days > 1) {
        subject = `${i.storeName}: your store subscription ends in ${days} days · اشتراك متجرك ينتهي خلال ${days} أيام`;
        en = `Your store <b>${i.storeName}</b>${plan} expires on <b>${date}</b> — in ${days} days. Renew now to keep it online without interruption.`;
        ar = `اشتراك متجرك <b>${i.storeName}</b>${plan} ينتهي يوم <b>${date}</b> — بعد ${days} أيام. جدّد الآن ليستمر متجرك بدون انقطاع.`;
    } else if (typeof i.stage === "number" && days === 1) {
        subject = `${i.storeName}: your store subscription ends tomorrow · اشتراك متجرك ينتهي غدًا`;
        en = `Your store <b>${i.storeName}</b>${plan} expires <b>tomorrow (${date})</b>. Renew today to avoid any interruption.`;
        ar = `اشتراك متجرك <b>${i.storeName}</b>${plan} ينتهي <b>غدًا (${date})</b>. جدّد اليوم لتجنّب أي انقطاع.`;
    } else if (typeof i.stage === "number") {
        subject = `${i.storeName}: your store subscription has expired · انتهى اشتراك متجرك`;
        en = `The subscription of <b>${i.storeName}</b>${plan} ended on <b>${date}</b>. The store stays online for <b>${i.graceDays} more day(s)</b>, then it will be suspended until you renew.`;
        ar = `انتهى اشتراك متجرك <b>${i.storeName}</b>${plan} يوم <b>${date}</b>. سيبقى المتجر متاحًا لمدة <b>${i.graceDays} يوم/أيام</b> ثم سيتم إيقافه حتى تجدّد.`;
    } else {
        {
            const keep = i.autoDeleteDays && i.autoDeleteDays > 0
                ? { en: `Your data is kept for <b>${i.autoDeleteDays} days</b>; after that the store is deleted permanently.`, ar: `بياناتك محفوظة لمدة <b>${i.autoDeleteDays} يوم</b>، وبعدها يُحذف المتجر نهائيًا.` }
                : { en: "Your products, orders and settings are kept and come back the moment you renew.", ar: "منتجاتك وطلباتك وإعداداتك محفوظة وتعود فور التجديد." };
            subject = `${i.storeName}: your store has been suspended · تم إيقاف متجرك`;
            en = `The subscription of <b>${i.storeName}</b>${plan} ended on <b>${date}</b> and the grace period is over, so the store is now <b>suspended</b> — visitors see a "temporarily unavailable" page. ${keep.en}`;
            ar = `انتهى اشتراك متجرك <b>${i.storeName}</b>${plan} يوم <b>${date}</b> وانتهت فترة السماح، لذا تم <b>إيقاف</b> المتجر — الزوار يرون صفحة "غير متاح مؤقتًا". ${keep.ar}`;
        }
    }

    const button = (label: string) =>
        `<a href="${i.renewUrl}" style="display:inline-block;background:#1E7D67;color:#fff;text-decoration:none;font-weight:800;padding:12px 26px;border-radius:999px;margin:16px 0">${label}</a>`;
    const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f3ee;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #eee">
      <div dir="rtl" style="text-align:right">
        <p style="margin:0 0 10px">مرحبًا ${name}،</p>
        <p style="margin:0 0 10px;line-height:1.7">${ar}</p>
        ${button("تجديد الاشتراك")}
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:18px 0">
      <div dir="ltr" style="text-align:left">
        <p style="margin:0 0 10px">Hello ${name},</p>
        <p style="margin:0 0 10px;line-height:1.7">${en}</p>
        ${button("Renew subscription")}
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#777">${i.storeName} · <a href="${url}" style="color:#1E7D67">${url}</a> · N.I.T</p>
    </div>
  </div>`;
    const strip = (s: string) => s.replace(/<[^>]+>/g, "");
    const text = `${strip(ar)}\n${i.renewUrl}\n\n${strip(en)}\n${i.renewUrl}\n\n${url}`;
    return { subject, text, html };
}

/** Sends one stage mail. Returns false (and logs) when SMTP is off — never throws
 *  for a configuration problem, so the cron keeps processing the other stores. */
export async function sendStoreExpiryEmail(i: StoreExpiryMailInput): Promise<boolean> {
    if (!mailerConfigured()) {
        console.error(`[storeExpiry] SMTP not configured — ${i.stage} mail for ${i.slug} not sent`);
        return false;
    }
    const m = buildStoreExpiryEmail(i);
    await sendEmail({ to: i.to, ...m });
    return true;
}
