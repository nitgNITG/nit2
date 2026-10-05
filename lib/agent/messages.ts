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

export function msg(key: MessageKey, locale: Locale, vars: Record<string, string> = {}): string {
    let s: string = T[key][locale];
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
}
