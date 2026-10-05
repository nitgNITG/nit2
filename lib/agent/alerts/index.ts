// Agent alerts (FR-S8, FR-H1, §13.16) through the existing lib/adminAlert.ts and
// lib/telegram.ts. Alerts carry ONLY business fields needed to act — no name,
// phone, email, full conversation, payment, tenant or error details; the
// dashboard link is where staff see the rest.
import { alertAdmins } from "@/lib/adminAlert";
import { notifyTelegram } from "@/lib/telegram";
import { redactText } from "../security/redaction";

export function dashboardLink(conversationId: string): string {
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.nitg-eg.com").replace(/\/$/, "");
    return `${base}/en/dashboard/conversations/${conversationId}`;
}

export type LeadAlertFields = {
    conversationId: string;
    tier: string | null;
    score: number | null;
    stage?: string | null;
    country?: string | null;
    service?: string | null;
    budget?: string | null;
    expectedUsers?: number | null;
    mobileApps?: boolean | null;
    videoProtection?: boolean | null;
    timeline?: string | null;
    brief?: string | null;
    nextAction?: string | null;
};

const yn = (v: boolean | null | undefined) => (v == null ? "—" : v ? "yes" : "no");

/** The allow-listed alert body (TS-47: nothing else can leak in). */
export function leadAlertBody(f: LeadAlertFields): string {
    return [
        `Tier: ${f.tier ?? "—"} · Score: ${f.score ?? "—"}${f.stage ? ` · Stage: ${f.stage}` : ""}`,
        `Country: ${f.country ?? "—"}`,
        `Service: ${f.service ?? "—"}`,
        `Budget: ${f.budget ?? "—"}`,
        `Expected users: ${f.expectedUsers ?? "—"}`,
        `Mobile apps: ${yn(f.mobileApps)} · Video protection: ${yn(f.videoProtection)}`,
        `Timeline: ${f.timeline ?? "—"}`,
        f.brief ? `AI brief (AI-generated): ${redactText(f.brief)}` : null,
        f.nextAction ? `Next action: ${f.nextAction}` : null,
        `Open: ${dashboardLink(f.conversationId)}`,
    ].filter(Boolean).join("\n");
}

/** HOT lead → Telegram + email (FR-S8). */
export async function alertHotLead(f: LeadAlertFields): Promise<void> {
    await alertAdmins("🔥 HOT lead from the AI assistant", leadAlertBody(f));
}

/** Lead reached stage sql / opportunity (AC-10.1) → Telegram. */
export async function alertQualifiedLead(f: LeadAlertFields): Promise<void> {
    await notifyTelegram(`🟢 Qualified lead from the AI assistant\n\n${leadAlertBody(f)}`);
}

/** Conversation handed to a person (FR-H1). The summary is masked for PII. */
export async function alertHandoff(input: { conversationId: string; reason: string; summary: string; mode: string }): Promise<void> {
    await notifyTelegram(
        [
            `🙋 Conversation needs a person (${input.mode})`,
            `Reason: ${redactText(input.reason).slice(0, 200)}`,
            `Summary: ${redactText(input.summary).slice(0, 800)}`,
            `Open: ${dashboardLink(input.conversationId)}`,
        ].join("\n"),
    );
}

/** A visitor wrote while a person owns the conversation (AC-12.1 / TS-08). */
export async function alertVisitorWaiting(conversationId: string): Promise<void> {
    await notifyTelegram(`💬 New visitor message in a conversation with a person\nOpen: ${dashboardLink(conversationId)}`);
}

export async function alertBudgetReached(date: string, budgetUsd: number): Promise<void> {
    await alertAdmins("⚠️ AI assistant daily budget reached", `The AI assistant used its $${budgetUsd} budget for ${date}. Visitors now see the WhatsApp / contact-form fallback until tomorrow.`);
}

export async function alertErrorBurst(count: number): Promise<void> {
    await notifyTelegram(`🚨 AI assistant: ${count} errors in the last 10 minutes. Check the server logs.`);
}
