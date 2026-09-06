import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { toLicenseDefinition } from "@/lib/licenseDefinition";
import { triggerApplyIntegrations } from "@/lib/provisionAcademy";

export const runtime = "nodejs";

// ── SaaS repo that holds the client branches (branch cleanup on delete) ───────
const OWNER = process.env.SAAS_REPO_OWNER ?? "NITGg";
const REPO = process.env.SAAS_REPO_NAME ?? "saas-demo";
const GH_API = "https://api.github.com";

const ghHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
});

// Ask server B to (re)apply the licence on the live academy — sets local_license
// tier + enabled + the dynamic definition (limits/features) JSON. Best-effort.
async function triggerApplyLicense(slug: string, tier: string): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const lic = await prisma.license.findUnique({ where: { key: tier } });
        const definition = lic
            ? toLicenseDefinition(lic, {
                  validUntil: (lic.durationDays ?? 0) > 0
                      ? new Date(Date.now() + (lic.durationDays ?? 0) * 86_400_000)
                      : null,
              })
            : "";
        const url = new URL(base);
        url.pathname = `/apply-license/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ tier, definition }),
        });
        // Push the new package's shared integration creds (Kashier/VDOCipher/Vimeo).
        if (lic) {
            await triggerApplyIntegrations(slug, {
                videoSource: lic.videoSource, kashierEnabled: lic.kashierEnabled,
            });
        }
    } catch (e) {
        console.error("[academies] apply-license trigger failed", slug, e);
    }
}

// PATCH /api/academies/<slug>
//   { status }  — lifecycle advance, called by the polling worker (WORKER_SECRET).
//   { tier }    — admin changes the plan: updates the control plane AND re-applies
//                 the licence to the live Moodle.
export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

    const data: {
        status?: string;
        tier?: string;
        subscribedAt?: Date;
        validUntil?: Date | null;
        expiryRemindersSent?: Record<string, never>;
    } = {};

    // Status transition — worker-guarded.
    if (body?.status !== undefined) {
        const secret = process.env.WORKER_SECRET;
        if (secret && req.headers.get("x-worker-secret") !== secret) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        const allowed = ["branch_created", "provisioning", "live", "failed"];
        if (!allowed.includes(body.status)) {
            return NextResponse.json({ error: "invalid status" }, { status: 400 });
        }
        data.status = body.status;
    }

    // Licence change — admin-guarded. Validate against the (dynamic) License table.
    let tierChanged: string | null = null;
    if (body?.tier !== undefined) {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        const key = String(body.tier).trim().toLowerCase();
        const lic = await prisma.license.findUnique({ where: { key } });
        if (!lic) {
            return NextResponse.json({ error: "unknown licence" }, { status: 400 });
        }
        data.tier = key;
        tierChanged = key;
        // Plan change starts a fresh subscription term from the new licence duration.
        const now = new Date();
        data.subscribedAt = now;
        data.validUntil = (lic.durationDays ?? 0) > 0
            ? new Date(now.getTime() + lic.durationDays * 86_400_000)
            : null;
        // Fresh term → re-arm the expiry reminders (7/3/1/on-expiry).
        data.expiryRemindersSent = {};
    }

    // Update image — admin-guarded, no DB change; recreate the container onto the
    // current baked image (preserves db + moodledata). Handled before the
    // "nothing to update" check because it doesn't write to `data`.
    if (body?.updateImage) {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        const academy = await prisma.academy.findUnique({ where: { slug: params.slug } });
        if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });
        if (!["live", "suspended"].includes(academy.status)) {
            return NextResponse.json({ error: "academy is not live yet" }, { status: 409 });
        }
        await triggerUpdateImage(params.slug);
        return NextResponse.json({ ok: true, slug: params.slug, status: "updating-image" });
    }

    // Suspend / resume — admin-guarded (soft-lock via local_license).
    let suspendChanged: boolean | null = null;
    if (body?.suspend !== undefined) {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        suspendChanged = !!body.suspend;
        data.status = suspendChanged ? "suspended" : "live";
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "nothing to update (status, tier or suspend)" }, { status: 400 });
    }

    try {
        const academy = await prisma.academy.update({ where: { slug: params.slug }, data });
        if (tierChanged) await triggerApplyLicense(params.slug, tierChanged); // push to the live Moodle
        if (suspendChanged !== null) await triggerSuspend(params.slug, suspendChanged);
        return NextResponse.json({ ok: true, slug: academy.slug, status: academy.status, tier: academy.tier });
    } catch (err: any) {
        if (err?.code === "P2025") {
            return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        return NextResponse.json({ error: err?.message || "update failed" }, { status: 400 });
    }
}

// Ask server B to recreate the academy's container onto the current baked image
// (SAAS_IMAGE), preserving its db + moodledata. Best-effort.
async function triggerUpdateImage(slug: string): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const url = new URL(base);
        url.pathname = `/update-image/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
        });
    } catch (e) {
        console.error("[academies] update-image trigger failed", slug, e);
    }
}

// Ask server B to soft-lock (suspend) or resume the live academy.
async function triggerSuspend(slug: string, suspend: boolean): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const url = new URL(base);
        url.pathname = `/suspend/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ suspended: suspend }),
        });
    } catch (e) {
        console.error("[academies] suspend trigger failed", slug, e);
    }
}

// Ask server B to tear the live site down (container + db + files + apache vhost).
// Best-effort and fire-and-forget: server B returns 202 and runs destroy.sh in
// the background. Reuses PROVISION_URL's origin, swapping the path for
// /deprovision/<slug>. If it's not configured or unreachable, we don't fail the
// delete — the control-plane record is still removed and teardown can be retried.
async function triggerDeprovision(slug: string): Promise<void> {
    const base = process.env.PROVISION_URL;      // e.g. https://saas-provision.…/provision
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const url = new URL(base);
        url.pathname = `/deprovision/${slug}`;
        await fetch(url.toString(), {
            method: "DELETE",
            headers: { "X-Provision-Secret": secret },
        });
    } catch (e) {
        console.error("[academies] deprovision trigger failed", slug, e);
    }
}

// Admin-only: remove a platform from the control plane. Best-effort deletes the
// client's GitHub branch too so the slug is free to be reused. The live site
// itself (if any) is torn down separately by the provisioning server.
export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const slug = params.slug;
    const academy = await prisma.academy.findUnique({ where: { slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Admins can delete any academy; a client may delete only their own.
    if (user.role !== "admin" && academy.ownerId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Best-effort: tell server B to tear the live site down (container + db +
    // files + apache vhost). Fire-and-forget — never block the delete over it.
    await triggerDeprovision(slug);

    // Best-effort: drop the GitHub branch so the slug becomes reusable. Never
    // block the DB delete over this — a missing branch (404) is fine.
    const token = process.env.GITHUB_TOKEN;
    if (token && academy.branch) {
        try {
            await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/refs/heads/${academy.branch}`, {
                method: "DELETE",
                headers: ghHeaders(token),
            });
        } catch (e) {
            console.error("[academies] branch delete failed", slug, e);
        }
    }

    try {
        await prisma.academy.delete({ where: { slug } });
    } catch (e) {
        console.error("[academies] db delete failed", slug, e);
        return NextResponse.json({ error: "delete failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, slug });
}
