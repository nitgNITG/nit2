// Customer-safe wording chosen by SERVER CODE from fixed mappings (FR-P3, FR-P4,
// TS-25, TS-56). Raw gateway responses, provider codes, transaction ids, stack
// traces and Tenant.lastError never reach the model or the visitor.
import type { Locale } from "../types";

type T = { ar: string; en: string };

const PAYMENT_REASON: Record<string, T> = {
    declined: {
        ar: "رفض البنك أو بوابة الدفع العملية. تأكد من بيانات البطاقة ورصيدها أو جرّب بطاقة أخرى.",
        en: "The bank or payment gateway declined the payment. Check the card details and balance, or try another card.",
    },
    checkout_failed: {
        ar: "تعذّر فتح صفحة الدفع وقتها. يمكنك المحاولة مرة أخرى.",
        en: "The payment page could not be opened at the time. You can try again.",
    },
    expired: {
        ar: "لم تكتمل عملية الدفع في الوقت المحدد.",
        en: "The checkout was not completed in time.",
    },
    paid_setup_issue: {
        ar: "تم استلام الدفع، لكن حدثت مشكلة أثناء تجهيز الخدمة وفريقنا يتابعها.",
        en: "The payment was received, but setting up the service hit a problem; our team is following up.",
    },
    renewal_failed: {
        ar: "لم ينجح التجديد التلقائي بالبطاقة المحفوظة. يمكنك تحديث البطاقة أو التجديد يدوياً.",
        en: "The automatic renewal with the saved card did not go through. You can update the card or renew manually.",
    },
    unknown: {
        ar: "لم تكتمل عملية الدفع.",
        en: "The payment did not go through.",
    },
};

/** Map a stored Payment to a fixed reason key — never echo the stored text. */
export function paymentReasonKey(p: { status: string; failureReason: string | null; subscriptionId?: string | null }): keyof typeof PAYMENT_REASON | null {
    const raw = (p.failureReason ?? "").toLowerCase();
    if (raw.startsWith("paid-but-provision-failed") || raw.startsWith("retry-provision-failed")) return "paid_setup_issue";
    if (p.status === "expired") return "expired";
    if (p.status !== "failed") return null;
    if (p.subscriptionId) return "renewal_failed";
    if (/declin|reject|insufficient|fail|cancel|refus/.test(raw)) return "declined";
    if (raw) return "checkout_failed";
    return "unknown";
}

export function paymentReason(p: Parameters<typeof paymentReasonKey>[0], locale: Locale): string | undefined {
    const k = paymentReasonKey(p);
    return k ? PAYMENT_REASON[k][locale] : undefined;
}

const TENANT_STATUS: Record<string, T> = {
    queued: { ar: "طلبك في قائمة الانتظار وسيبدأ التجهيز خلال دقائق.", en: "Your request is queued; setup will start within minutes." },
    branch_created: { ar: "تم إنشاء الطلب وجاري تجهيز المنصة.", en: "Your request was created and the platform is being prepared." },
    provisioning: { ar: "جاري تجهيز المنصة الآن، وعادة ما يستغرق ذلك بضع دقائق.", en: "Your platform is being set up right now; this usually takes a few minutes." },
    live: { ar: "المنصة جاهزة وتعمل.", en: "Your platform is ready and running." },
    failed: {
        ar: "تعثّر تجهيز المنصة. فريقنا الفني سيتابع ويحل المشكلة، ويمكنني فتح تذكرة دعم أو تحويلك لأحد أعضاء الفريق.",
        en: "Setting up your platform ran into a problem. Our technical team will fix it; I can open a support ticket or connect you with a team member.",
    },
    suspended: {
        ar: "المنصة موقوفة حالياً، غالباً بسبب انتهاء الاشتراك. يمكنك التجديد لإعادة تشغيلها.",
        en: "Your platform is currently suspended, usually because the subscription ended. Renewing brings it back.",
    },
};

export function tenantStatusMessage(status: string, locale: Locale): string {
    return (TENANT_STATUS[status] ?? {
        ar: "حالة المنصة غير معروفة حالياً؛ يمكنني تحويلك لأحد أعضاء الفريق.",
        en: "The platform status is not clear right now; I can connect you with a team member.",
    })[locale];
}

/** Step numbers only — the provisioner's own label is internal and never shown. */
export function provisioningStep(progress: unknown): { step: number; total: number } | null {
    if (!progress || typeof progress !== "object") return null;
    const p = progress as { step?: unknown; total?: unknown };
    const step = typeof p.step === "number" ? p.step : NaN;
    const total = typeof p.total === "number" ? p.total : NaN;
    return Number.isFinite(step) && Number.isFinite(total) && total > 0 ? { step: Math.max(0, Math.min(step, total)), total } : null;
}
