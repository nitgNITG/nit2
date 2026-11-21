/**
 * Deleting a tenant (academy or store) — one flow for the owner/admin DELETE
 * routes, the expiry cron's auto-delete and the provisioner callbacks.
 *
 * The control-plane row is NOT deleted until the provisioner confirms the
 * teardown finished. Until then the tenant sits in status "deleting": billing is
 * already cancelled and owners no longer see it, but the slug stays taken and the
 * row stays as the record of what still has to be removed on the box. Deleting
 * the row first (the old behaviour) left the whole site running whenever the
 * provisioner was down, busy or failed — with nothing left in nit2 to find it.
 *
 *   beginTenantDelete     → mark deleting, cancel billing, start the teardown,
 *                           wait briefly for it to finish
 *   reconcileDeletingTenant → (cron / callbacks) check, retry or finish
 *   finalizeTenantDelete  → teardown confirmed: delete the row (+ academy branch)
 */
import prisma from "@/lib/prismaMysql";
import { alertAdmins } from "@/lib/adminAlert";
import { notifyTelegram } from "@/lib/telegram";
import { academyTeardownStatus, deleteAcademyBranch, startAcademyTeardown, type TeardownState } from "@/lib/provisionAcademy";
import { storeOps } from "@/lib/products/store";

export const DELETING = "deleting";
/** A create job is still running on the box: deleting now would race it. */
export const CREATE_IN_FLIGHT = ["queued", "provisioning"];

type TenantRow = {
    slug: string;
    product: string;
    status: string;
    branch?: string | null;
    customDomain?: string | null;
    lastError?: string | null;
};

export type DeleteOutcome =
    | { state: "deleted" }
    | { state: "deleting"; reason?: string }
    | { state: "busy" }
    | { state: "not_found" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start the teardown on the right provisioner. */
async function startTeardown(t: TenantRow): Promise<{ ok: boolean; error?: string }> {
    if (t.product === "store") {
        const r = await storeOps.deprovision(t.slug);
        return r.ok ? { ok: true } : { ok: false, error: `${r.status || "no response"}: ${r.error}` };
    }
    const r = await startAcademyTeardown(t.slug, t.customDomain);
    return r.ok ? { ok: true } : { ok: false, error: `${r.status || "no response"}: ${r.error}` };
}

/** What the provisioner says about this tenant's teardown. null = unreachable. */
export async function teardownStatus(t: TenantRow): Promise<{ state: TeardownState; error?: string } | null> {
    if (t.product !== "store") return academyTeardownStatus(t.slug);
    const r = await storeOps.status(t.slug);
    // 404 "unknown store": no job and no files on the host — nothing left to remove.
    if (!r.ok) return r.status === 404 ? { state: "done" } : null;
    const job = r.data ?? {};
    if (job.kind !== "destroy") return { state: "none" }; // the last job on the host was not a teardown
    if (job.state === "done") return { state: "done" };
    if (job.state === "failed") return { state: "failed", error: String(job.error ?? "") };
    return { state: "running" };
}

/** Teardown confirmed: remove the row (and the academy's client branch). Idempotent. */
export async function finalizeTenantDelete(t: TenantRow, by = ""): Promise<boolean> {
    if (t.product !== "store") await deleteAcademyBranch(t.branch);
    // Only a row still marked "deleting" goes (deleteMany: a second callback is a no-op).
    const r = await prisma.tenant.deleteMany({ where: { slug: t.slug, status: DELETING } });
    if (r.count === 0) return false;
    await notifyTelegram(`🗑 ${t.product === "store" ? "Store" : "Academy"} deleted: ${t.slug}${by ? ` (${by})` : ""}`);
    return true;
}

/** Record a failed / not-started teardown on the row and tell the admins — once per distinct error. */
async function recordProblem(t: TenantRow, error: string, subject: string): Promise<void> {
    const msg = error.slice(0, 2000);
    await prisma.tenant.update({ where: { slug: t.slug }, data: { lastError: msg } }).catch(() => {});
    if (t.lastError === msg) return; // already alerted for exactly this
    await alertAdmins(subject, `${msg}\n\nThe ${t.product} stays in "deleting" (hidden from its owner, billing cancelled). The daily cron retries; fix the cause or clean the box up by hand.`);
}

/**
 * Owner/admin delete and the cron's auto-delete. Marks the tenant "deleting",
 * cancels its billing, asks the provisioner to tear it down and waits up to
 * `waitMs` for that to finish (then the row is deleted right away).
 */
export async function beginTenantDelete(slug: string, opts: { by: string; waitMs?: number; pollMs?: number }): Promise<DeleteOutcome> {
    const t = await prisma.tenant.findUnique({
        where: { slug },
        select: { slug: true, product: true, status: true, branch: true, customDomain: true, lastError: true },
    });
    if (!t) return { state: "not_found" };
    if (CREATE_IN_FLIGHT.includes(t.status)) return { state: "busy" };

    if (t.status !== DELETING) {
        await prisma.tenant.update({ where: { slug }, data: { status: DELETING, lastError: null } });
        t.status = DELETING;
        t.lastError = null;
    }
    // Stop billing now — never charge for a tenant that is on its way out.
    await prisma.subscription.updateMany({
        where: { tenantSlug: slug, status: { in: ["active", "past_due"] } },
        data: { status: "canceled", autoRenew: false, nextAttemptAt: null, lastError: `${t.product} deleted` },
    }).catch((e) => console.error("[teardown] subscription cancel failed", slug, e));

    const started = await startTeardown(t);
    if (!started.ok) {
        const reason = `teardown not started: ${started.error}`;
        await recordProblem(t, reason, `⚠️ ${t.product} ${slug}: delete could not reach the provisioner`);
        return { state: "deleting", reason };
    }

    // Most teardowns take seconds — wait a little so the usual case finishes in this request.
    const deadline = Date.now() + (opts.waitMs ?? 0);
    const poll = opts.pollMs ?? 3000;
    while (Date.now() < deadline) {
        await sleep(Math.min(poll, Math.max(0, deadline - Date.now())));
        const s = await teardownStatus(t);
        if (s?.state === "done" || s?.state === "unsupported") {
            return (await finalizeTenantDelete(t, opts.by)) ? { state: "deleted" } : { state: "deleting" };
        }
        if (s?.state === "failed") {
            await recordProblem(t, `teardown failed: ${s.error ?? "see the provisioner log"}`, `❌ ${t.product} ${slug}: teardown failed`);
            return { state: "deleting", reason: "teardown failed" };
        }
    }
    return { state: "deleting" };
}

/** HTTP answer for the DELETE routes: 200 deleted · 202 still tearing down · 409 create running. */
export function deleteResponse(slug: string, r: DeleteOutcome): Response {
    const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (r.state === "not_found") return json({ error: "not found" }, 404);
    if (r.state === "busy") return json({ error: "still being created — delete it once that finishes (or fails)" }, 409);
    if (r.state === "deleted") return json({ ok: true, slug, state: "deleted" }, 200);
    return json({ ok: true, slug, state: "deleting", ...(r.reason ? { reason: r.reason } : {}) }, 202);
}

export type ReconcileResult = "deleted" | "running" | "failed" | "restarted" | "not_started" | "unreachable";

/** Cron / callbacks: bring a "deleting" tenant one step closer to gone. */
export async function reconcileDeletingTenant(t: TenantRow): Promise<ReconcileResult> {
    const s = await teardownStatus(t);
    if (!s) return "unreachable";
    // unsupported = server B predates the status endpoint: it accepted the job, trust it (old behaviour).
    if (s.state === "done" || s.state === "unsupported") {
        return (await finalizeTenantDelete(t, "teardown confirmed")) ? "deleted" : "running";
    }
    if (s.state === "running") return "running";
    if (s.state === "failed") {
        await recordProblem(t, `teardown failed: ${s.error ?? "see the provisioner log"}`, `❌ ${t.product} ${t.slug}: teardown failed`);
        return "failed";
    }
    // none: the provisioner never got (or lost) the request — send it again.
    const started = await startTeardown(t);
    if (started.ok) return "restarted";
    await recordProblem(t, `teardown not started: ${started.error}`, `⚠️ ${t.product} ${t.slug}: delete could not reach the provisioner`);
    return "not_started";
}

/** Every tenant stuck in "deleting" (daily cron). */
export async function reconcileAllDeleting(): Promise<Record<string, ReconcileResult>> {
    const rows = await prisma.tenant.findMany({
        where: { status: DELETING },
        select: { slug: true, product: true, status: true, branch: true, customDomain: true, lastError: true },
    });
    const out: Record<string, ReconcileResult> = {};
    for (const t of rows) {
        try {
            out[t.slug] = await reconcileDeletingTenant(t);
        } catch (e) {
            console.error("[teardown] reconcile failed", t.slug, e);
            out[t.slug] = "unreachable";
        }
    }
    return out;
}
