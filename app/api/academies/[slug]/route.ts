import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";
import { getCurrentUser } from "@/lib/auth";

// ── SaaS repo that holds the client branches ──────────────────────────────────
const OWNER = process.env.SAAS_REPO_OWNER ?? "NITGg";
const REPO = process.env.SAAS_REPO_NAME ?? "saas-demo";
const GH_API = "https://api.github.com";

const ghHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
});

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
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const slug = params.slug;
    const academy = await prisma.academy.findUnique({ where: { slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });

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
