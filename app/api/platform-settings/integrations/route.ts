import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/predict";
import { INTEGRATION_FIELDS, loadIntegrationMasked, saveIntegrationSettings } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/platform-settings/integrations — admin only. Secrets are returned
// MASKED (only whether they're set); non-secret fields (base URLs, sandbox flag,
// public client id) are returned in clear so the form can show them.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const fields = INTEGRATION_FIELDS.map((f) => ({ key: f.key, secret: f.secret, label: f.label }));
        const values = await loadIntegrationMasked();
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
        return NextResponse.json({ error: "write failed" }, { status: 500 });
    }
}
