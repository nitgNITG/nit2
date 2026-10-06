// Fixed visitor-facing texts (NFR-14). Server-chosen, never model-written.
import type { Locale } from "./tools/types";

const T = {
    fallback: {
        ar: "عذراً، المساعد غير متاح الآن. تواصل معنا على واتساب أو من خلال نموذج التواصل وسنرد عليك سريعاً.",
        en: "Sorry, the assistant is not available right now. Reach us on WhatsApp or through the contact form and we'll get back to you quickly.",
    },
    handoffOpen: {
        ar: "تم تحويل المحادثة لأحد أعضاء فريق N.I.T وسيرد عليك هنا خلال دقائق.",
        en: "I've passed the conversation to an N.I.T team member — they'll reply here within a few minutes.",
    },
    handoffClosed: {
        ar: "تم تحويل المحادثة لفريق N.I.T. نحن خارج ساعات العمل الآن، وسيرد عليك أحد الزملاء {next}. لو تحب، اترك رقم هاتفك أو واتساب ليتواصلوا معك.",
        en: "I've passed the conversation to the N.I.T team. We're outside working hours now; a team member will reply {next}. If you like, leave your phone or WhatsApp number so they can reach you.",
    },
    tender: {
        ar: "طلبات المناقصات والعروض الرسمية يتولاها فريق المبيعات مباشرة. ",
        en: "Tenders and formal proposal requests are handled directly by our sales team. ",
    },
    limitReached: {
        ar: "وصلت هذه المحادثة للحد الأقصى. سأحولك لأحد أعضاء الفريق لمتابعة طلبك.",
        en: "This conversation has reached its limit. I'll pass you to a team member to continue.",
    },
    turnLimit: {
        ar: "عذراً، لم أستطع إكمال الرد. هل تحب أن أحولك لأحد أعضاء الفريق؟",
        en: "Sorry, I couldn't complete that answer. Would you like me to connect you with a team member?",
    },
} as const;

export type MessageKey = keyof typeof T;

// Built at runtime: tsconfig has no target, so TS rejects a /u regex literal.
const LETTER = new RegExp("\\p{L}", "gu");
const ARABIC = /[؀-ۿݐ-ݿ]/;

/**
 * The language the visitor actually writes in. Server-written texts (handoff,
 * tender, limits) and the reply language follow it — not the page's language: an
 * Arabic speaker on /en must get Arabic. Too little text to tell → `fallback`.
 */
export function detectLocale(text: string, fallback: Locale): Locale {
    const letters = text.match(LETTER) ?? [];
    if (letters.length < 2) return fallback;
    const arabic = letters.filter((c) => ARABIC.test(c)).length / letters.length;
    if (arabic >= 0.3) return "ar";
    if (arabic === 0 && letters.length >= 3) return "en";
    return fallback;
}

export function msg(key: MessageKey, locale: Locale, vars: Record<string, string> = {}): string {
    let s: string = T[key][locale];
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
}
