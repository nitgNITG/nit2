import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/platform-settings/apply
// Re-push the current global settings to EVERY live academy's Moodle (used after
// a global value changes). Best-effort per academy; returns how many were queued.
export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) {
        return NextResponse.json({ error: "provisioning not configured (PROVISION_URL/SECRET)" }, { status: 400 });
    }

    try {
        const [rows, academies] = await Promise.all([
            prisma.platformSetting.findMany(),
            prisma.academy.findMany({ where: { status: "live" }, select: { slug: true } }),
        ]);
        const settings: Record<string, string> = Object.fromEntries(
            rows.filter((r) => (r.value ?? "").trim() !== "").map((r) => [r.key, r.value]),
        );
        // Account/dashboard base URL for the in-academy "Upgrade" deep link. Taken
        // from the host this request came in on (falls back to the configured base).
        const proto = req.headers.get("x-forwarded-proto") || "https";
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
        const accountUrl = (host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "")).replace(/\/$/, "");
        if (accountUrl) settings.account_url = accountUrl;

        // Fire /apply-settings/<slug> for each live academy — best-effort, in parallel.
        const results = await Promise.allSettled(
            academies.map((a) => {
                const url = new URL(base);
                url.pathname = `/apply-settings/${a.slug}`;
                return fetch(url.toString(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
                    body: JSON.stringify({ settings }),
                });
            }),
        );
        const queued = results.filter((r) => r.status === "fulfilled").length;
        return NextResponse.json({ ok: true, academies: academies.length, queued });
    } catch (err) {
        console.error("[platform-settings/apply] failed", err);
        return NextResponse.json({ error: "apply failed" }, { status: 500 });
    }
}
