import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_MIN_FREE_PCT } from "@/lib/serverHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Control-plane settings for the provisioning health gate + admin alerts. Stored
// in PlatformSetting; NOT pushed to any academy's Moodle. Admin-only to read/write
// (admin_alert_emails / support_whatsapp are operational, not public).
//   server_min_free_pct  — minimum free-disk % to allow creating an academy
//   admin_alert_emails   — comma/space-separated recipients for admin alerts
//   support_whatsapp     — the WhatsApp shown to a user blocked by the gate
const KEYS = ["server_min_free_pct", "admin_alert_emails", "support_whatsapp"] as const;
type Key = (typeof KEYS)[number];

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    if (user.role !== "admin") return { error: "forbidden", status: 403 as const };
    return { user };
}

export async function GET() {
    const gate = await requireAdmin();
    if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const rows = await prisma.platformSetting.findMany({ where: { key: { in: KEYS as unknown as string[] } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return NextResponse.json({
        server_min_free_pct: map.server_min_free_pct ?? String(DEFAULT_MIN_FREE_PCT),
        admin_alert_emails: map.admin_alert_emails ?? "",
        support_whatsapp: map.support_whatsapp ?? "",
    });
}

export async function PUT(req: NextRequest) {
    const gate = await requireAdmin();
    if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const ops = [];
    for (const key of KEYS) {
        if (!(key in body)) continue;
        let value = String((body as Record<Key, unknown>)[key] ?? "").trim();
        if (key === "server_min_free_pct") {
            const n = Math.trunc(Number(value));
            if (!Number.isFinite(n) || n < 0 || n > 99) {
                return NextResponse.json({ error: "server_min_free_pct must be 0–99" }, { status: 400 });
            }
            value = String(n);
        }
        ops.push(prisma.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } }));
    }
    if (ops.length) await prisma.$transaction(ops);
    return NextResponse.json({ ok: true, updated: ops.length });
}
