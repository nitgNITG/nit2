import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/predict";
import { pushStoreSettingsToHost } from "@/lib/storeSettings";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/platform-settings/apply-stores — admin. Push the saved host settings
// to the store provisioner: it rewrites provision.env and re-applies the
// per-store keys (mail, Cloudinary, Google, memory) to every running store.
export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const r = await pushStoreSettingsToHost();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    await notifyTelegram(`⚙️ Store host settings pushed (${r.changed.length ? r.changed.join(", ") : "no change"}) → applying to ${r.stores} store(s)`).catch(() => {});
    return NextResponse.json(r);
}
