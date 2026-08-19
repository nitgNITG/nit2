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
