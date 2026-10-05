// Shared bits for the /api/agent/** route handlers (route files stay thin).
import { NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { supportWhatsapp } from "@/lib/adminAlert";
import { getCurrentUser } from "@/lib/auth";
import { currentSessionId } from "./security/visitor-session";
import { fallbackLinks } from "./runtime/streaming";

export const OBJECT_ID = /^[a-f0-9]{24}$/;

/** §8: errors are { error, message } (+ extra fields such as fallback). */
export function apiError(status: number, error: string, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
    return NextResponse.json({ error, message, ...extra }, { status, headers });
}

export async function fallbackFor(locale: string) {
    return fallbackLinks(await supportWhatsapp(), locale === "en" ? "en" : "ar");
}

export { stripLocale, widgetAllowedOn } from "./placement";

/**
 * The conversation if the caller owns it — the signed agent_session cookie
 * matches its sessionId, or the signed-in user matches its userId — else null.
 * Callers answer null with 404 so the response never reveals that it exists.
 */
export async function loadOwnedConversation(req: Request, id: string) {
    if (!OBJECT_ID.test(id)) return null;
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return null;
    const sessionId = await currentSessionId(req);
    if (sessionId && conv.sessionId === sessionId) return conv;
    if (conv.userId) {
        const user = await getCurrentUser();
        if (user && user.id === conv.userId) return conv;
    }
    return null;
}
