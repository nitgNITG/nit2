import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyTelegram } from "@/lib/telegram";
import { storeProvisionerCall } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/stores/update-images { tag }  (admin) — roll EVERY store to an image
// tag: the provisioner pulls the three images once, then `docker compose up -d`
// per store (only changed services restart); pinned stores are skipped. CI does
// the same call after pushing a release; this is the manual button.
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const tag = String(body?.tag ?? "").trim();
    if (!TAG_RE.test(tag)) return NextResponse.json({ error: "bad tag" }, { status: 400 });
    const r = await storeProvisionerCall("/update-image", { body: { tag } });
    if (!r.ok) return NextResponse.json({ error: `provisioner: ${r.error}` }, { status: r.status === 0 ? 503 : 502 });
    await notifyTelegram(`🛒 Rolling out store images ${tag} to all stores (admin)`);
    return NextResponse.json({ ok: true, tag, status: "rolling-out" });
}
