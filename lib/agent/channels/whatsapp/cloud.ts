// Meta WhatsApp Cloud API (phase 3, FR-WA1–WA4, NFR-4, NFR-5). Server-only:
// the access token never reaches the browser. Settings live in the MySQL
// PlatformSetting `whatsapp_cloud` (token encrypted with lib/secretBox.ts),
// with env fallbacks; the webhook secrets come from env only.
import crypto from "node:crypto";
import mysql from "@/lib/prismaMysql";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";

export const WA_SETTING_KEY = "whatsapp_cloud";
const GRAPH = "https://graph.facebook.com";
const MAX_TEXT = 4096; // Cloud API text body limit

export type WaCloudConfig = { phoneNumberId: string; wabaId: string; accessToken: string; graphVersion: string };
type Stored = { phoneNumberId?: string; wabaId?: string; tokenEnc?: string; graphVersion?: string };

async function readStored(): Promise<Stored> {
    try {
        const row = await mysql.platformSetting.findUnique({ where: { key: WA_SETTING_KEY } });
        return row?.value ? (JSON.parse(row.value) as Stored) : {};
    } catch {
        return {};
    }
}

/** Dashboard settings first, env second; null until number id + token exist. */
export async function getWaConfig(): Promise<WaCloudConfig | null> {
    const s = await readStored();
    const phoneNumberId = s.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    const accessToken = decryptSecret(s.tokenEnc) || process.env.WHATSAPP_ACCESS_TOKEN || "";
    if (!phoneNumberId || !accessToken) return null;
    return {
        phoneNumberId, accessToken,
        wabaId: s.wabaId || process.env.WHATSAPP_WABA_ID || "",
        graphVersion: s.graphVersion || process.env.WHATSAPP_GRAPH_VERSION || "v23.0",
    };
}

/** What the settings card shows — never the token itself. */
export async function waStatus() {
    const s = await readStored();
    const cfg = await getWaConfig();
    return {
        phoneNumberId: s.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        wabaId: s.wabaId || process.env.WHATSAPP_WABA_ID || "",
        graphVersion: cfg?.graphVersion ?? (s.graphVersion || process.env.WHATSAPP_GRAPH_VERSION || "v23.0"),
        tokenSet: !!cfg?.accessToken,
        tokenSource: decryptSecret(s.tokenEnc) ? "dashboard" : process.env.WHATSAPP_ACCESS_TOKEN ? "env" : null,
        appSecretSet: !!process.env.WHATSAPP_APP_SECRET,
        verifyTokenSet: !!process.env.WHATSAPP_VERIFY_TOKEN,
        encryptionReady: !!process.env.CREDENTIAL_SECRET,
    };
}

/** Save from the dashboard. An empty token keeps the stored one. */
export async function saveWaSettings(input: { phoneNumberId: string; wabaId: string; accessToken?: string; graphVersion?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const prev = await readStored();
    let tokenEnc = prev.tokenEnc;
    if (input.accessToken) {
        const enc = encryptSecret(input.accessToken);
        if (!enc) return { ok: false, error: "CREDENTIAL_SECRET is not set on the server, so the token can't be stored encrypted." };
        tokenEnc = enc;
    }
    const value = JSON.stringify({ phoneNumberId: input.phoneNumberId, wabaId: input.wabaId, tokenEnc, graphVersion: input.graphVersion || prev.graphVersion });
    await mysql.platformSetting.upsert({ where: { key: WA_SETTING_KEY }, create: { key: WA_SETTING_KEY, value }, update: { value } });
    return { ok: true };
}

/** NFR-5: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifySignature(rawBody: string, header: string | null, appSecret = process.env.WHATSAPP_APP_SECRET || ""): boolean {
    if (!appSecret || !header?.startsWith("sha256=")) return false;
    const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
    const given = Buffer.from(header.slice(7), "hex");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Meta's wa_id ("201001234567") → "+201001234567". */
export const toE164 = (waId: string) => `+${waId.replace(/\D/g, "")}`;

/** Long replies are split on paragraph / line boundaries under the 4096-char limit. */
export function splitText(text: string, max = MAX_TEXT): string[] {
    const parts: string[] = [];
    let rest = text.trim();
    while (rest.length > max) {
        let cut = rest.lastIndexOf("\n\n", max);
        if (cut < max / 2) cut = rest.lastIndexOf("\n", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut < max / 2) cut = max;
        parts.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
}

export class WaSendError extends Error {
    constructor(message: string, readonly code: number | null) { super(message); }
}

async function graphPost(cfg: WaCloudConfig, body: unknown): Promise<{ messages?: { id: string }[] }> {
    const res = await fetch(`${GRAPH}/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number }; messages?: { id: string }[] };
    if (!res.ok || json.error) throw new WaSendError(json.error?.message ?? `HTTP ${res.status}`, json.error?.code ?? null);
    return json;
}

/** Send a text (split if long). Returns the WhatsApp message ids. Throws WaSendError. */
export async function sendWaText(toE164Phone: string, text: string, cfg?: WaCloudConfig | null): Promise<string[]> {
    const c = cfg ?? (await getWaConfig());
    if (!c) throw new WaSendError("WhatsApp is not configured (phone number id / access token).", null);
    const ids: string[] = [];
    for (const part of splitText(text)) {
        const r = await graphPost(c, {
            messaging_product: "whatsapp", recipient_type: "individual", to: toE164Phone.replace(/^\+/, ""),
            type: "text", text: { body: part, preview_url: true },
        });
        if (r.messages?.[0]?.id) ids.push(r.messages[0].id);
    }
    return ids;
}

/** An approved template (needed outside the 24-hour window). Meta's sample `hello_world` exists on every account. */
export async function sendWaTemplate(toE164Phone: string, name: string, languageCode: string, cfg?: WaCloudConfig | null): Promise<string | null> {
    const c = cfg ?? (await getWaConfig());
    if (!c) throw new WaSendError("WhatsApp is not configured (phone number id / access token).", null);
    const r = await graphPost(c, {
        messaging_product: "whatsapp", to: toE164Phone.replace(/^\+/, ""), type: "template",
        template: { name, language: { code: languageCode } },
    });
    return r.messages?.[0]?.id ?? null;
}

/**
 * Meta only delivers a WhatsApp account's messages to the apps subscribed to
 * it (POST /{waba}/subscribed_apps) — the app's webhook settings alone are not
 * enough. Lists the subscribed apps; subscribe() links the token's app.
 */
export async function wabaSubscription(cfg?: WaCloudConfig | null): Promise<{ ok: true; apps: { id: string; name: string }[] } | { ok: false; error: string }> {
    const c = cfg ?? (await getWaConfig());
    if (!c?.wabaId) return { ok: false, error: "Set the WhatsApp Business Account ID first." };
    try {
        const res = await fetch(`${GRAPH}/${c.graphVersion}/${c.wabaId}/subscribed_apps`, {
            headers: { Authorization: `Bearer ${c.accessToken}` }, signal: AbortSignal.timeout(15_000),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { whatsapp_business_api_data?: { id?: string; name?: string } }[]; error?: { message?: string } };
        if (!res.ok || json.error) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
        return { ok: true, apps: (json.data ?? []).map((d) => ({ id: d.whatsapp_business_api_data?.id ?? "", name: d.whatsapp_business_api_data?.name ?? "" })) };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

export async function subscribeWaba(cfg?: WaCloudConfig | null): Promise<{ ok: true } | { ok: false; error: string }> {
    const c = cfg ?? (await getWaConfig());
    if (!c?.wabaId) return { ok: false, error: "Set the WhatsApp Business Account ID first." };
    try {
        const res = await fetch(`${GRAPH}/${c.graphVersion}/${c.wabaId}/subscribed_apps`, {
            method: "POST", headers: { Authorization: `Bearer ${c.accessToken}` }, signal: AbortSignal.timeout(15_000),
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
        if (!res.ok || json.error || json.success === false) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

/** Blue ticks on the customer's message. Best-effort. */
export async function markWaRead(messageId: string, cfg?: WaCloudConfig | null): Promise<void> {
    try {
        const c = cfg ?? (await getWaConfig());
        if (c) await graphPost(c, { messaging_product: "whatsapp", status: "read", message_id: messageId });
    } catch { /* not important */ }
}

// ---- Incoming webhook payload ----

export type WaInbound = {
    id: string; // Meta message id (wamid…)
    from: string; // E.164
    name: string | null;
    timestamp: Date;
    type: string;
    text: string | null; // null for media we can't read
    phoneNumberId: string | null;
};

type Payload = {
    object?: string;
    entry?: { changes?: { field?: string; value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string };
            button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }[];
        statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string }[] }[];
    } }[] }[];
};

/** Customer messages in a webhook call. Delivery statuses are returned separately (failures are logged). */
export function parseWebhook(body: unknown): { messages: WaInbound[]; failedStatuses: { id: string; error: string }[] } {
    const p = body as Payload;
    const messages: WaInbound[] = [];
    const failedStatuses: { id: string; error: string }[] = [];
    if (p?.object !== "whatsapp_business_account") return { messages, failedStatuses };
    for (const e of p.entry ?? []) {
        for (const ch of e.changes ?? []) {
            const v = ch.value;
            if (!v) continue;
            for (const s of v.statuses ?? []) {
                if (s.status === "failed" && s.id) failedStatuses.push({ id: s.id, error: s.errors?.[0]?.title ?? "failed" });
            }
            for (const m of v.messages ?? []) {
                if (!m.id || !m.from) continue;
                const contact = v.contacts?.find((c) => c.wa_id === m.from);
                const text = m.type === "text" ? m.text?.body ?? ""
                    : m.type === "button" ? m.button?.text ?? ""
                    : m.type === "interactive" ? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ""
                    : null;
                messages.push({
                    id: m.id, from: toE164(m.from), name: contact?.profile?.name ?? null, type: m.type ?? "unknown", text,
                    timestamp: new Date(Number(m.timestamp ?? 0) * 1000 || Date.now()), phoneNumberId: v.metadata?.phone_number_id ?? null,
                });
            }
        }
    }
    return { messages, failedStatuses };
}
