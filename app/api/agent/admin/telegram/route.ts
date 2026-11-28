// /api/agent/admin/telegram (admin) — the AI assistant's own Telegram alerts.
// GET: status (never the token); PUT: save bot token (encrypted) + chat id;
// POST { action: "find_chats", botToken? }: chats that recently wrote to the bot;
// POST { action: "test" }: send a test alert.
import { z } from "zod";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { findChats, saveTelegram, sendTelegramTest, telegramStatus } from "@/lib/agent/alerts/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const g = await guard("settings");
    if (g.res) return g.res;
    return Response.json(await telegramStatus());
}

const SaveSchema = z.strictObject({
    botToken: z.string().trim().regex(/^(\d{5,15}:[\w-]{20,60})?$/, "looks like 123456789:AA…").optional(),
    chatId: z.string().trim().regex(/^(-?\d{3,20})?$/, "a number, e.g. -1001234567890"),
});

export async function PUT(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return apiError(400, "validation_failed", "Check the fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    }
    const r = await saveTelegram(parsed.data);
    if (!r.ok) return apiError(400, "not_saved", r.error);
    return Response.json(await telegramStatus());
}

export async function POST(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    const body = (await req.json().catch(() => null)) as { action?: string; botToken?: string } | null;
    if (body?.action === "find_chats") {
        const r = await findChats(body.botToken?.trim() || undefined);
        return r.ok ? Response.json(r) : apiError(502, "telegram_failed", r.error);
    }
    if (body?.action === "test") {
        const r = await sendTelegramTest();
        return r.ok ? Response.json(r) : apiError(502, "telegram_failed", r.error);
    }
    return apiError(400, "validation_failed", "Unknown action.");
}
