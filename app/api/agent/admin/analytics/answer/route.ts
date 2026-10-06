// POST /api/agent/admin/analytics/answer (admin) — FR-N3: answer a question the
// assistant could not answer; the answer joins the knowledge notes in one step.
import { z } from "zod";
import { apiError, OBJECT_ID } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { answerUnknownQuestion } from "@/lib/agent/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.strictObject({
    conversationId: z.string().regex(OBJECT_ID),
    question: z.string().trim().min(2).max(300),
    answer: z.string().trim().min(2).max(2000),
    locale: z.enum(["ar", "en"]),
});

export async function POST(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = Body.safeParse(json);
    if (!parsed.success) return apiError(400, "invalid_body", "conversationId, question, answer and locale are required.");
    const cfg = await answerUnknownQuestion(parsed.data);
    return Response.json({ ok: true, version: cfg.version });
}
