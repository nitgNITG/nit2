// /api/agent/admin/whatsapp (admin) — WhatsApp Cloud API settings for AI Settings.
// GET: status (never the token); PUT: save number id / account id / token
// (encrypted); POST: send Meta's hello_world template to a number as a test.
import { z } from "zod";
import { apiError } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { saveWaSettings, sendWaTemplate, waStatus, WaSendError } from "@/lib/agent/channels/whatsapp/cloud";
import { normalizePhone } from "@/lib/spamRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookUrl = () => `${(process.env.NEXT_PUBLIC_BASE_URL || "https://www.nitg-eg.com").replace(/\/$/, "")}/api/agent/whatsapp/webhook`;

export async function GET() {
    const g = await guard("settings");
    if (g.res) return g.res;
    return Response.json({ ...(await waStatus()), webhookUrl: webhookUrl() });
}

const SaveSchema = z.strictObject({
    phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "digits only"),
    wabaId: z.string().trim().regex(/^(\d{5,30})?$/, "digits only"),
    accessToken: z.string().trim().max(1000).optional(),
    graphVersion: z.string().trim().regex(/^v\d{2}\.\d$/, "like v23.0").optional(),
});

export async function PUT(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return apiError(400, "validation_failed", "Check the fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    }
    const r = await saveWaSettings(parsed.data);
    if (!r.ok) return apiError(400, "not_saved", r.error);
    return Response.json({ ...(await waStatus()), webhookUrl: webhookUrl() });
}

export async function POST(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    const body = (await req.json().catch(() => null)) as { to?: string } | null;
    const to = normalizePhone(body?.to ?? "");
    if (!to || !to.startsWith("+")) return apiError(400, "validation_failed", "Use the full number with country code, e.g. +201001234567.");
    try {
        const id = await sendWaTemplate(to, "hello_world", "en_US");
        return Response.json({ sent: true, id });
    } catch (e) {
        return apiError(502, "whatsapp_send_failed", e instanceof WaSendError ? e.message : "Could not reach WhatsApp.");
    }
}
