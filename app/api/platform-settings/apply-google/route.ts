import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { authAdmin } from "@/lib/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/platform-settings/apply-google
// Enable "Sign in with Google" on EVERY live academy's login page by pushing just
// the Google OAuth credentials (client id + secret) to each academy's Moodle.
// Requires both to be saved first. Best-effort per academy; returns how many were
// queued. New academies pick this up automatically at build time.
export async function POST(req: NextRequest) {
    if (!(await authAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) {
        return NextResponse.json({ error: "provisioning not configured (PROVISION_URL/SECRET)" }, { status: 400 });
    }

    try {
        const rows = await prisma.platformSetting.findMany({
            where: { key: { in: ["google_client_id", "google_client_secret"] } },
        });
        const g = Object.fromEntries(rows.map((r) => [r.key, (r.value ?? "").trim()]));
        if (!g.google_client_id || !g.google_client_secret) {
            return NextResponse.json(
                { error: "Save both the Google client id and client secret first." },
                { status: 400 },
            );
        }

        const academies = await prisma.academy.findMany({ where: { status: "live" }, select: { slug: true } });

        // Push ONLY the Google credentials — apply-settings.sh runs apply_google_login.php
        // when both are present, which (idempotently) configures the OAuth2 issuer.
        const settings = {
            google_client_id: g.google_client_id,
            google_client_secret: g.google_client_secret,
        };
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
        console.error("[platform-settings/apply-google] failed", err);
        return NextResponse.json({ error: "apply failed" }, { status: 500 });
    }
}
