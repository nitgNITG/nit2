import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { notifyTelegram } from "@/lib/telegram";
import { STORE_PRODUCT, storeLiveUrl, storeOps, pushStoreLicense } from "@/lib/products/store";
import { createStore } from "@/lib/tenants/createStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/stores/<slug> — mirror of /api/academies/<slug> for the store product.
//   GET     owner or admin: the row (+ url)
//   PATCH   admin: { tier } | { suspend } | { validUntil } | { updateImage, tag? } | { retry }
//   DELETE  owner or admin: deprovision + delete row + cancel subscriptions

const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

async function loadStore(slug: string) {
    const t = await prisma.tenant.findUnique({ where: { slug } }).catch(() => null);
    return t && t.product === STORE_PRODUCT ? t : null;
}

function publicRow(t: NonNullable<Awaited<ReturnType<typeof loadStore>>>) {
    const { adminPasswordEnc: _a, nitAdminPasswordEnc: _n, ...rest } = t;
    return { ...rest, url: storeLiveUrl(t.slug) };
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const store = await loadStore(params.slug);
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && store.ownerId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ store: publicRow(store) });
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const slug = params.slug;
    const store = await loadStore(slug);
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });

    // ── Plan change: fresh term from the new licence, pushed to the live store ──
    if (body?.tier !== undefined) {
        const key = String(body.tier).trim().toLowerCase();
        const lic = await prisma.license.findUnique({ where: { key } });
        if (!lic || lic.product !== STORE_PRODUCT) return NextResponse.json({ error: "unknown licence" }, { status: 400 });
        const now = new Date();
        const validUntil = (lic.durationDays ?? 0) > 0 ? new Date(now.getTime() + lic.durationDays * 86_400_000) : null;
        const updated = await prisma.tenant.update({
            where: { slug },
            data: { tier: key, subscribedAt: now, validUntil, expiryRemindersSent: {} },
        });
        const push = await pushStoreLicense(slug);
        if (!push.ok) console.error("[stores] licence push failed", slug, push.error);
        await notifyTelegram(`🛒 Store ${slug} plan → ${key} (admin)`);
        return NextResponse.json({ ok: true, store: publicRow(updated), pushed: push.ok });
    }

    // ── Suspend / resume ────────────────────────────────────────────────────
    if (body?.suspend !== undefined) {
        const suspended = !!body.suspend;
        const r = await storeOps.suspend(slug, suspended);
        if (!r.ok) return NextResponse.json({ error: `provisioner: ${r.error}` }, { status: 502 });
        const updated = await prisma.tenant.update({ where: { slug }, data: { status: suspended ? "suspended" : "live" } });
        await notifyTelegram(`${suspended ? "⏸" : "▶️"} Store ${slug} ${suspended ? "suspended" : "resumed"} (admin)`);
        return NextResponse.json({ ok: true, store: publicRow(updated) });
    }

    // ── Term extension (manual) ─────────────────────────────────────────────
    if (body?.validUntil !== undefined) {
        const d = body.validUntil === null ? null : new Date(body.validUntil);
        if (d && Number.isNaN(d.getTime())) return NextResponse.json({ error: "bad validUntil" }, { status: 400 });
        const revive = store.status === "suspended" && d && d.getTime() > Date.now();
        const updated = await prisma.tenant.update({
            where: { slug },
            data: { validUntil: d, expiryRemindersSent: {}, ...(revive ? { status: "live" } : {}) },
        });
        if (revive) await storeOps.suspend(slug, false);
        await pushStoreLicense(slug);
        return NextResponse.json({ ok: true, store: publicRow(updated) });
    }

    // ── Move to an image tag (queued on the provisioner; progress callback updates imageTag) ──
    if (body?.updateImage) {
        if (!["live", "suspended"].includes(store.status)) return NextResponse.json({ error: "store is not live yet" }, { status: 409 });
        const tag = String(body?.tag ?? "latest");
        if (!TAG_RE.test(tag)) return NextResponse.json({ error: "bad tag" }, { status: 400 });
        const r = await storeOps.updateImage(slug, tag);
        if (!r.ok) return NextResponse.json({ error: `provisioner: ${r.error}` }, { status: r.status === 409 ? 409 : 502 });
        return NextResponse.json({ ok: true, slug, status: "updating-image", job: r.data?.job ?? null });
    }

    // ── Retry a failed creation (free/comp stores; paid ones use /api/payments/<order>/retry-provision) ──
    if (body?.retry) {
        if (store.status !== "failed") return NextResponse.json({ error: "only a failed store can be retried" }, { status: 409 });
        const lic = await prisma.license.findUnique({ where: { key: store.tier } });
        const owner = await prisma.user.findUnique({ where: { id: store.ownerId ?? "" }, select: { id: true, email: true, name: true } });
        if (!lic || !owner) return NextResponse.json({ error: "licence or owner missing" }, { status: 400 });
        const rank = await prisma.license.findMany({ where: { active: true, product: STORE_PRODUCT }, select: { key: true, active: true, order: true, priceEgp: true } });
        // One job on the provisioner: destroy the leftovers, then create again (force).
        await prisma.tenant.delete({ where: { slug } });
        const result = await createStore({
            slug, name: store.name, store: {}, lic, rank,
            durationDays: store.validUntil ? Math.max(1, Math.ceil((store.validUntil.getTime() - Date.now()) / 86_400_000)) : 0,
            owner: { id: owner.id, email: owner.email, name: owner.name ?? "", locale: "ar" },
            licenseMode: (store.licenseMode as "live" | "test" | null) ?? null,
            force: true,
        });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ ok: true, slug, job: result.job, status: "queued" });
    }

    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const slug = params.slug;
    const store = await loadStore(slug);
    if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && store.ownerId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Best-effort teardown on the provisioner (queued); never block the delete over it.
    const r = await storeOps.deprovision(slug);
    if (!r.ok) console.error("[stores] deprovision request failed", slug, r.error);

    try {
        await prisma.tenant.delete({ where: { slug } });
    } catch (e) {
        console.error("[stores] db delete failed", slug, e);
        return NextResponse.json({ error: "delete failed" }, { status: 500 });
    }
    try {
        await prisma.subscription.updateMany({
            where: { tenantSlug: slug, status: { in: ["active", "past_due"] } },
            data: { status: "canceled", autoRenew: false, nextAttemptAt: null, lastError: "store deleted" },
        });
    } catch (e) {
        console.error("[stores] subscription cancel on delete failed", slug, e);
    }
    await notifyTelegram(`🗑 Store deleted: ${slug}`);
    return NextResponse.json({ ok: true, slug });
}
