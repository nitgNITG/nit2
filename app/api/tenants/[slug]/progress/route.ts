import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { alertAdmins } from "@/lib/adminAlert";
import { encryptSecret } from "@/lib/secretBox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Provisioner → nit2 progress callback (any product). Replaces the never-called
// worker PATCH {status}: the store provisioner posts every step of a job here
// and always ends with `done` or `failed`, so a tenant never sits at
// "Preparing…" with nobody knowing why. Header: x-worker-secret = WORKER_SECRET.
//
// Body: { product, job, kind, state: running|done|failed, step, total, label,
//         url?, error?, image_tag?, owner_email?, owner_password?, destroyed?, domain? }
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
    const secret = process.env.WORKER_SECRET;
    if (!secret || req.headers.get("x-worker-secret") !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const slug = params.slug;
    if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const state = String(body?.state ?? "");
    const kind = String(body?.kind ?? "");
    if (!["running", "done", "failed"].includes(state)) return NextResponse.json({ error: "bad state" }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { slug } }).catch(() => null);
    if (!tenant) {
        // A destroy job for a row we already deleted, or a job for an unknown slug.
        return NextResponse.json({ ok: true, ignored: true });
    }

    const progress = {
        job: Number(body?.job) || 0, kind, state,
        step: Number(body?.step) || 0, total: Number(body?.total) || 0,
        label: String(body?.label ?? "").slice(0, 200),
        at: new Date().toISOString(),
    };
    const data: Record<string, unknown> = { progressJson: progress };

    if (kind === "create") {
        if (state === "running" && tenant.status === "queued") data.status = "provisioning";
        if (state === "done") {
            data.status = "live";
            // Live over HTTP only: certbot could not issue the cert (usually the wildcard
            // DNS record is missing). Kept in lastError so the card/admin page show it.
            data.lastError = body?.tls === "pending"
                ? "TLS certificate pending — DNS for this store does not point here yet. Add the wildcard A record, then Issue TLS."
                : null;
            if (typeof body?.image_tag === "string" && body.image_tag) data.imageTag = body.image_tag;
            // Only when nit2 did not supply the owner password (fallback): store it encrypted.
            if (typeof body?.owner_password === "string" && body.owner_password.length >= 8 && !tenant.adminPasswordEnc) {
                data.adminPasswordEnc = encryptSecret(body.owner_password);
            }
        }
        if (state === "failed") {
            data.status = "failed";
            data.lastError = String(body?.error ?? "provisioning failed").slice(0, 2000);
        }
    } else if (kind === "update-image") {
        if (state === "done" && typeof body?.image_tag === "string" && body.image_tag) data.imageTag = body.image_tag;
        if (state === "failed") data.lastError = String(body?.error ?? "image update failed").slice(0, 2000);
    } else if (kind === "bind-domain") {
        if (state === "done") { data.domainStatus = "active"; data.domainError = null; }
        if (state === "failed") { data.domainStatus = "failed"; data.domainError = String(body?.error ?? "bind failed").slice(0, 2000); }
    } else if (kind === "unbind-domain") {
        if (state === "done") { data.customDomain = null; data.domainStatus = "none"; data.domainError = null; }
    } else if (kind === "destroy") {
        if (state === "failed") data.lastError = String(body?.error ?? "destroy failed").slice(0, 2000);
    }

    await prisma.tenant.update({ where: { slug }, data }).catch((e) => console.error("[tenants/progress] update failed", slug, e));

    if (kind === "create" && state === "done") {
        await alertAdmins(`✅ ${tenant.product} ${slug} is live`, `${body?.url ?? ""}${body?.mail_sent === false ? "\n(welcome e-mail NOT sent — mail not configured on the provisioner)" : ""}`);
    } else if (state === "failed") {
        await alertAdmins(`❌ ${tenant.product} ${slug}: ${kind} failed`, String(body?.error ?? "").slice(0, 1500));
    }
    return NextResponse.json({ ok: true });
}
