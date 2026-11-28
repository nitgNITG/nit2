// Anonymous visitor session (NFR-20). The browser holds a signed, HttpOnly
// `agent_session` cookie naming a server-side AgentSession; localStorage keeps
// only the conversation id. Conversation access requires that session (or the
// signed-in owner), so a leaked conversation id alone reveals nothing.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/prisma/client";

export const SESSION_COOKIE = "agent_session";
const MAX_AGE_S = 30 * 24 * 3600;
const OBJECT_ID = /^[a-f0-9]{24}$/;

function key(): Buffer | null {
    const secret = process.env.SECRET_JWT;
    if (!secret) return null;
    return createHash("sha256").update(`agent_session:${secret}`).digest();
}

function mac(id: string, k: Buffer): string {
    return createHmac("sha256", k).update(id).digest("base64url");
}

export function signSessionId(id: string): string | null {
    const k = key();
    return k ? `${id}.${mac(id, k)}` : null;
}

/** The session id inside a cookie value, or null when unsigned/forged/malformed. */
export function verifySessionCookie(value: string | null | undefined): string | null {
    if (!value) return null;
    const k = key();
    if (!k) return null;
    const dot = value.indexOf(".");
    if (dot <= 0) return null;
    const id = value.slice(0, dot);
    if (!OBJECT_ID.test(id)) return null;
    const given = Buffer.from(value.slice(dot + 1));
    const want = Buffer.from(mac(id, k));
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
    return id;
}

export function readCookie(req: Request, name: string): string | null {
    const header = req.headers.get("cookie");
    if (!header) return null;
    for (const part of header.split(";")) {
        const i = part.indexOf("=");
        if (i < 0) continue;
        if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return null;
}

export function clientIp(req: Request): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")?.trim()
        || "unknown";
}

/** SHA-256 of the IP with AGENT_IP_SALT — used for rate limits only (NFR-6). */
export function hashIp(ip: string): string {
    return createHash("sha256").update(`${process.env.AGENT_IP_SALT ?? ""}:${ip}`).digest("hex");
}

export function sessionCookieHeader(signed: string): string {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return `${SESSION_COOKIE}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${secure}`;
}

/** The verified session id from the request cookie, if the session still exists. */
export async function currentSessionId(req: Request): Promise<string | null> {
    const id = verifySessionCookie(readCookie(req, SESSION_COOKIE));
    if (!id) return null;
    const row = await prisma.agentSession.findUnique({ where: { id } });
    if (!row) return null;
    await prisma.agentSession.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    return id;
}

/** Existing session, or a new one plus the Set-Cookie header to send. */
export async function ensureSession(
    req: Request,
    opts: { ipHash: string; userId?: string | null },
): Promise<{ sessionId: string; setCookie: string | null }> {
    const existing = await currentSessionId(req);
    if (existing) return { sessionId: existing, setCookie: null };
    const row = await prisma.agentSession.create({ data: { ipHash: opts.ipHash, userId: opts.userId ?? null } });
    const signed = signSessionId(row.id);
    if (!signed) throw new Error("SECRET_JWT is not set — cannot sign the agent session");
    return { sessionId: row.id, setCookie: sessionCookieHeader(signed) };
}
