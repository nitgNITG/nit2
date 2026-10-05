// E1 — GET /api/agent/config?locale=ar&page=/ar/moodle-lms (public).
// Widget config + page-aware prompt; sets the agent_session cookie when missing.
import { NextRequest, NextResponse } from "next/server";
import { supportWhatsapp } from "@/lib/adminAlert";
import { getAgentConfig, pickPagePrompt, widgetAllowedOn } from "@/lib/agent";
import { workingHoursStatus } from "@/lib/agent/runtime/hours";
import { clientIp, ensureSession, hashIp } from "@/lib/agent/security/visitor-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
    const page = (url.searchParams.get("page") ?? "").slice(0, 300) || null;

    const cfg = await getAgentConfig();
    const whatsapp = await supportWhatsapp();
    const wh = workingHoursStatus(cfg.workingHours);
    // Off (→ the widget shows the WhatsApp button, FR-W8) when switched off or with no budget.
    const enabled = cfg.enabled.web && cfg.dailyBudgetUsd > 0;

    const res = NextResponse.json({
        enabled,
        hidden: !widgetAllowedOn(page), // dashboard / payment / sign-in pages (FR-W1)
        greeting: cfg.greeting[locale],
        suggestions: cfg.suggestions[locale],
        whatsapp,
        workingHours: { open: wh.open, tz: cfg.workingHours.tz, nextOpenAt: wh.nextOpenAt?.toISOString() ?? null },
        proactivePrompt: enabled ? pickPagePrompt(cfg.pagePromptRules, page, locale) : null,
    });
    res.headers.set("Cache-Control", "no-store");

    if (enabled && widgetAllowedOn(page)) {
        try {
            const { setCookie } = await ensureSession(req, { ipHash: hashIp(clientIp(req)) });
            if (setCookie) res.headers.append("Set-Cookie", setCookie);
        } catch (e) {
            console.error("[agent] could not create a visitor session", (e as Error).message);
        }
    }
    return res;
}
