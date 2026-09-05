import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/predict";
import { INTEGRATION_FIELDS, loadIntegrationMasked, loadIntegrationRevealed, saveIntegrationSettings } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/platform-settings/integrations — admin only. Secrets are returned
// MASKED (only whether they're set) by default; non-secret fields (base URLs,
// sandbox flag, public client id) are always in clear so the form can show them.
// With ?reveal=1 the decrypted secret values are returned too — used by the
// admin "show value" (eye) toggle. Admin-gated; keep this off the default load.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const fields = INTEGRATION_FIELDS.map((f) => ({ key: f.key, secret: f.secret, label: f.label }));
        const reveal = req.nextUrl.searchParams.get("reveal") === "1";
        const values = reveal ? await loadIntegrationRevealed() : await loadIntegrationMasked();
        return NextResponse.json({ fields, values });
    } catch (err) {
        console.error("[integrations] read failed", err);
        return NextResponse.json({ error: "read failed" }, { status: 500 });
    }
}

// PUT /api/platform-settings/integrations — admin only. Secrets are encrypted;
// leaving a secret field blank keeps the stored value (so you needn't retype it).
export async function PUT(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const body = (await req.json()) as Record<string, unknown>;
        const updated = await saveIntegrationSettings(body);
        return NextResponse.json({ ok: true, updated });
    } catch (err) {
        console.error("[integrations] write failed", err);
        const message = err instanceof Error ? err.message : "write failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
