import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { toLicenseDefinition } from "@/lib/licenseDefinition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Repo the academies branch from ────────────────────────────────────────────
const OWNER = process.env.SAAS_REPO_OWNER ?? "NITGg";
const REPO = process.env.SAAS_REPO_NAME ?? "saas-demo";
const BASE_BRANCH = process.env.SAAS_BASE_BRANCH ?? "main";
const GH_API = "https://api.github.com";
const ghHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
});

// Fast-forward a client/<slug> branch up to the base branch so the container's
// `git pull --ff-only` actually receives new template code. A client branch has
// no commits of its own (provisioning only writes DB/config), so this is a pure
// fast-forward; if one ever diverged, GitHub rejects the non-ff (force:false) and
// we skip it — the update still runs, just on the old code. Best-effort per slug.
async function fastForwardToBase(slug: string, token: string, baseSha: string): Promise<void> {
    const ref = `heads/client/${slug}`;
    const res = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/refs/${ref}`, {
        method: "PATCH",
        headers: ghHeaders(token),
        body: JSON.stringify({ sha: baseSha, force: false }),
    });
    if (!res.ok && res.status !== 422) {
        console.warn(`[update-sites] ff ${slug} failed`, res.status, await res.text().catch(() => ""));
    }
}

// POST /api/academies/update-sites   { slug? }
// Refresh the running code on live academies (pull latest branch + upgrade + purge).
// With `slug` → just that one; otherwise every live academy. Admin only.
export async function POST(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) {
        return NextResponse.json({ error: "provisioning not configured (PROVISION_URL/SECRET)" }, { status: 400 });
    }

    let one: string | undefined;
    try { one = (await req.json())?.slug; } catch { /* no body → all */ }

    try {
        const academies = one
            ? await prisma.academy.findMany({ where: { slug: one }, select: { slug: true, tier: true } })
            : await prisma.academy.findMany({ where: { status: "live" }, select: { slug: true, tier: true } });

        // Map each licence key → its definition, so update also re-applies the licence.
        const licenses = await prisma.license.findMany();
        const defByKey = new Map(licenses.map((l) => [l.key, toLicenseDefinition(l)]));

        // Advance every client branch to the base branch first, so the pull below
        // actually delivers new template code. Skipped silently if GH isn't set up.
        const token = process.env.GITHUB_TOKEN;
        if (token) {
            try {
                const refRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BASE_BRANCH}`, {
                    headers: ghHeaders(token), cache: "no-store",
                });
                if (refRes.ok) {
                    const baseSha: string = (await refRes.json()).object.sha;
                    await Promise.allSettled(academies.map((a) => fastForwardToBase(a.slug, token, baseSha)));
                } else {
                    console.warn("[update-sites] could not read base branch sha", refRes.status);
                }
            } catch (e) {
                console.warn("[update-sites] branch sync skipped", e);
            }
        }

        const results = await Promise.allSettled(
            academies.map((a) => {
                const url = new URL(base);
                url.pathname = `/update-site/${a.slug}`;
                return fetch(url.toString(), {
                    method: "POST",
                    headers: { "X-Provision-Secret": secret, "Content-Type": "application/json" },
                    body: JSON.stringify({ tier: a.tier, definition: defByKey.get(a.tier) ?? "" }),
                });
            }),
        );
        const queued = results.filter((r) => r.status === "fulfilled").length;
        return NextResponse.json({ ok: true, academies: academies.length, queued });
    } catch (err) {
        console.error("[academies/update-sites] failed", err);
        return NextResponse.json({ error: "update failed" }, { status: 500 });
    }
}
