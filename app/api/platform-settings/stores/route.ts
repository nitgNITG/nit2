import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/predict";
import { STORE_FIELDS, loadStoreSettingsMasked, saveStoreSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/platform-settings/stores — admin. Field definitions + values; secrets
// are masked (only whether they are set), like the integrations endpoint.
export async function GET(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const fields = STORE_FIELDS.map(({ key, label, secret, host, hint, placeholder, group }) => ({ key, label, secret: !!secret, host: host ?? null, hint, placeholder, group }));
        return NextResponse.json({ fields, values: await loadStoreSettingsMasked() });
    } catch (err) {
        console.error("[store-settings] read failed", err);
        return NextResponse.json({ error: "read failed" }, { status: 500 });
    }
}

// PUT /api/platform-settings/stores — admin. Blank secret = keep stored value.
export async function PUT(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    try {
        const body = (await req.json()) as Record<string, unknown>;
        const updated = await saveStoreSettings(body);
        return NextResponse.json({ ok: true, updated });
    } catch (err) {
        const message = err instanceof Error ? err.message : "write failed";
        return NextResponse.json({ error: message }, { status: message.includes("CREDENTIAL_SECRET") ? 500 : 400 });
    }
}
