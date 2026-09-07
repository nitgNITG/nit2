// Best-effort Telegram notices for academy lifecycle events (created, deleted,
// expired/suspended, renewed, extended …). No-op when TELEGRAM_BOT_TOKEN /
// TELEGRAM_CHAT_ID are unset. NEVER throws — a notify failure must never break
// the action it reports on. Runtime env (not NEXT_PUBLIC), so no build inlining.

export async function notifyTelegram(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true,
            }),
        });
    } catch (e) {
        console.error("[telegram] notify failed", e);
    }
}
