// The AI assistant's own Telegram bot/chat (handoffs, HOT leads, tickets,
// meetings, budget, errors), separate from the SaaS notices in lib/telegram.ts.
// Set in AI Settings → Telegram alerts: MySQL PlatformSetting `ai_agent_telegram`,
// bot token encrypted with lib/secretBox.ts. Not set → the shared SaaS bot
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), so alerts never go quiet. Never throws.
import mysql from "@/lib/prismaMysql";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";
import { notifyTelegram } from "@/lib/telegram";

export const TG_SETTING_KEY = "ai_agent_telegram";
type Stored = { tokenEnc?: string; chatId?: string };

async function readStored(): Promise<Stored> {
    try {
        const row = await mysql.platformSetting.findUnique({ where: { key: TG_SETTING_KEY } });
        return row?.value ? (JSON.parse(row.value) as Stored) : {};
    } catch {
        return {};
    }
}

async function agentBot(): Promise<{ token: string; chatId: string } | null> {
    const s = await readStored();
    const token = decryptSecret(s.tokenEnc);
    return token && s.chatId ? { token, chatId: s.chatId } : null;
}

async function send(token: string, chatId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
            signal: AbortSignal.timeout(10_000),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
        return json.ok ? { ok: true } : { ok: false, error: json.description ?? `HTTP ${res.status}` };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

/** Send an AI-assistant alert to its own chat, or to the shared bot when none is set. */
export async function agentTelegram(text: string): Promise<void> {
    const bot = await agentBot();
    if (!bot) return notifyTelegram(text);
    const r = await send(bot.token, bot.chatId, text);
    if (!r.ok) console.error("[agent] telegram alert failed", r.error);
}

/** What the settings card shows — never the token. */
export async function telegramStatus() {
    const s = await readStored();
    return {
        chatId: s.chatId ?? "",
        tokenSet: !!decryptSecret(s.tokenEnc),
        usingShared: !(await agentBot()),
        sharedConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        encryptionReady: !!process.env.CREDENTIAL_SECRET,
    };
}

/** Save from the dashboard. An empty token keeps the stored one; both empty = back to the shared bot. */
export async function saveTelegram(input: { botToken?: string; chatId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
    const prev = await readStored();
    let tokenEnc = prev.tokenEnc;
    if (input.botToken) {
        const enc = encryptSecret(input.botToken);
        if (!enc) return { ok: false, error: "CREDENTIAL_SECRET is not set on the server, so the token can't be stored encrypted." };
        tokenEnc = enc;
    }
    const value = JSON.stringify(input.chatId || input.botToken ? { tokenEnc, chatId: input.chatId } : {});
    await mysql.platformSetting.upsert({ where: { key: TG_SETTING_KEY }, create: { key: TG_SETTING_KEY, value }, update: { value } });
    return { ok: true };
}

/** Chats that recently wrote to (or added) the bot — so nobody has to dig the chat ID out of a URL. */
export async function findChats(botToken?: string): Promise<{ ok: true; chats: { id: string; title: string; type: string }[] } | { ok: false; error: string }> {
    const token = botToken || decryptSecret((await readStored()).tokenEnc);
    if (!token) return { ok: false, error: "Paste the bot token first." };
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?allowed_updates=${encodeURIComponent('["message","my_chat_member","channel_post"]')}`, { signal: AbortSignal.timeout(10_000) });
        type Chat = { id: number; title?: string; username?: string; first_name?: string; type: string };
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message?: { chat: Chat }; my_chat_member?: { chat: Chat }; channel_post?: { chat: Chat } }[] };
        if (!json.ok) return { ok: false, error: json.description ?? `HTTP ${res.status}` };
        const seen = new Map<string, { id: string; title: string; type: string }>();
        for (const u of json.result ?? []) {
            const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
            if (c) seen.set(String(c.id), { id: String(c.id), title: c.title ?? c.username ?? c.first_name ?? String(c.id), type: c.type });
        }
        return { ok: true, chats: Array.from(seen.values()) };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

export async function sendTelegramTest(): Promise<{ ok: true; target: "agent" | "shared" } | { ok: false; error: string }> {
    const text = "✅ Test from the N.I.T AI assistant — AI Inbox alerts will arrive in this chat.";
    const bot = await agentBot();
    if (!bot) {
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return { ok: false, error: "No AI bot set and no shared bot in the server env." };
        const r = await send(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, text);
        return r.ok ? { ok: true, target: "shared" } : r;
    }
    const r = await send(bot.token, bot.chatId, text);
    return r.ok ? { ok: true, target: "agent" } : r;
}
