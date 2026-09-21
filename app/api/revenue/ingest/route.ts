import { NextRequest, NextResponse } from "next/server";
// Central revenue ledger lives in the MySQL control plane.
import prisma from "@/lib/prismaMysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/revenue/ingest — an academy's Moodle mirrors one completed payment here.
// Auth: shared secret in the `x-revenue-secret` header (REVENUE_INGEST_SECRET), the
// same value provisioned into each academy. This is a REPORTING mirror only; it never
// moves money, so a shared secret + self-declared academy slug is acceptable.
// Idempotent on (tenantSlug, orderId): a resend just updates the row (e.g. refund).

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const KINDS = new Set(["course", "subscription"]);
const STATUSES = new Set(["paid", "refunded"]);

export async function POST(req: NextRequest) {
    const expected = process.env.REVENUE_INGEST_SECRET;
    if (!expected) {
        console.error("[revenue/ingest] REVENUE_INGEST_SECRET is not set");
        return NextResponse.json({ error: "not configured" }, { status: 500 });
    }
    if (req.headers.get("x-revenue-secret") !== expected) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    // The academies' Moodle mirror still sends `academySlug` (its own contract); accept both.
    const tenantSlug = String(body?.tenantSlug ?? body?.academySlug ?? "").trim().toLowerCase();
    const orderId = String(body?.orderId ?? "").trim();
    const amount = Math.trunc(Number(body?.amount));
    const currency = String(body?.currency ?? "EGP").trim().toUpperCase().slice(0, 8) || "EGP";
    const provider = String(body?.provider ?? "kashier").trim().toLowerCase().slice(0, 32) || "kashier";
    const status = STATUSES.has(String(body?.status)) ? String(body.status) : "paid";
    const kind = KINDS.has(String(body?.kind)) ? String(body.kind) : "course";
    const courseId = body?.courseId != null && Number.isFinite(Number(body.courseId)) ? Math.trunc(Number(body.courseId)) : null;
    const userRef = body?.userRef != null ? String(body.userRef).slice(0, 64) : null;
    const mode = String(body?.mode) === "test" ? "test" : "live";

    if (!SLUG_RE.test(tenantSlug)) {
        return NextResponse.json({ error: "invalid academySlug" }, { status: 400 });
    }
    if (!orderId || orderId.length > 191) {
        return NextResponse.json({ error: "invalid orderId" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
    const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
        return NextResponse.json({ error: "invalid paidAt" }, { status: 400 });
    }

    try {
        await prisma.tenantRevenue.upsert({
            where: { tenantSlug_orderId: { tenantSlug, orderId } },
            update: { amount, currency, status, kind, courseId, userRef, paidAt, provider, mode },
            create: { tenantSlug, orderId, amount, currency, status, kind, courseId, userRef, paidAt, provider, mode },
        });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e) {
        console.error("[revenue/ingest] upsert failed", e);
        return NextResponse.json({ error: "write failed" }, { status: 500 });
    }
}
