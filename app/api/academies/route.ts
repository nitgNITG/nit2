import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/client";

// ── SaaS repo that holds the base ("main") every academy branches from ────────
const OWNER = process.env.SAAS_REPO_OWNER ?? "NITGg";
const REPO = process.env.SAAS_REPO_NAME ?? "saas-demo";
const BASE_BRANCH = process.env.SAAS_BASE_BRANCH ?? "main";
const GH_API = "https://api.github.com";

// ── Rate limit: max N academies per IP per hour (public endpoint) ─────────────
// Controlled by env ACADEMIES_RATE_LIMIT: a number sets the cap; 0 disables it.
const ipCache = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = Number(process.env.ACADEMIES_RATE_LIMIT ?? 500);
const RATE_WINDOW_MS = 60 * 60 * 1000;
function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = ipCache.get(ip);
    if (!entry || now > entry.resetAt) {
        ipCache.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

// Branch-safe identifier: lowercase english/digits/hyphens, 3–40 chars, no
// leading/trailing hyphen. Keeps branch names (and future subdomains) clean.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const ghHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
});

// Ask server B's provisioning endpoint to turn the new branch into a live site.
// Best-effort: if it's not configured or unreachable, the branch still exists and
// provisioning can be retried manually — we never fail the request over this.
async function triggerProvision(slug: string, name: string): Promise<void> {
    const url = process.env.PROVISION_URL;       // e.g. https://saas-provision.academy2026.nitg-eg.com/provision
    const secret = process.env.PROVISION_SECRET;
    if (!url || !secret) return;
    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ slug, name }),
        });
    } catch (e) {
        console.error("[academies] provision trigger failed", e);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, slug, _hp } = body ?? {};

        // Honeypot — bots fill the hidden field, humans don't. Fake success.
        if (_hp) return NextResponse.json({ ok: true, branch: "" }, { status: 201 });

        // Rate limit by IP
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (RATE_LIMIT > 0 && !checkRateLimit(ip)) {
            return NextResponse.json({ error: "محاولات كتير في وقت قصير، حاول بعد شوية." }, { status: 429 });
        }

        const cleanName = (name ?? "").toString().trim();
        const cleanSlug = (slug ?? "").toString().trim().toLowerCase();

        if (!cleanName) {
            return NextResponse.json({ error: "اسم الأكاديمية مطلوب." }, { status: 400 });
        }
        if (!SLUG_RE.test(cleanSlug)) {
            return NextResponse.json(
                { error: "المعرّف لازم يكون حروف إنجليزية صغيرة وأرقام وشرطات (3 إلى 40 حرف)." },
                { status: 400 }
            );
        }

        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error("[academies] GITHUB_TOKEN is not set");
            return NextResponse.json({ error: "الخدمة غير مهيأة حالياً، جرّب لاحقاً." }, { status: 500 });
        }

        const branch = `client/${cleanSlug}`;

        // Already taken in our records? Best-effort — if the control-plane DB is
        // unreachable we don't block branch creation; GitHub's 422 still catches
        // a duplicate branch below.
        try {
            const existing = await prisma.academy.findUnique({ where: { slug: cleanSlug } });
            if (existing) {
                return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });
            }
        } catch (dbErr) {
            console.warn("[academies] duplicate pre-check skipped (DB unavailable)", dbErr);
        }

        const headers = ghHeaders(token);

        // 1) Get the SHA the base branch currently points at.
        const refRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BASE_BRANCH}`, {
            headers,
            cache: "no-store",
        });
        if (!refRes.ok) {
            console.error("[academies] read base failed", refRes.status, await refRes.text());
            return NextResponse.json({ error: "تعذّر الوصول للفرع الأساسي، حاول تاني." }, { status: 502 });
        }
        const baseSha: string = (await refRes.json()).object.sha;

        // 2) Create the client branch pointing at that SHA (a branch is just a ref).
        const createRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/refs`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        });

        // 422 = ref already exists on GitHub (someone took it outside our records).
        if (createRes.status === 422) {
            return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });
        }
        if (!createRes.ok) {
            console.error("[academies] create branch failed", createRes.status, await createRes.text());
            return NextResponse.json({ error: "فشل إنشاء المنصة، حاول تاني." }, { status: 502 });
        }

        // Branch created → kick off the live-site build on server B (fire-and-forget).
        await triggerProvision(cleanSlug, cleanName);

        // 3) Record it (control plane). Guard the rare race on the unique slug.
        try {
            const academy = await prisma.academy.create({
                data: { name: cleanName, slug: cleanSlug, branch, status: "branch_created" },
            });
            return NextResponse.json(
                { ok: true, slug: academy.slug, branch: academy.branch },
                { status: 201 }
            );
        } catch (dbErr: any) {
            // P2002 = unique constraint (two requests raced on the same slug).
            if (dbErr?.code === "P2002") {
                return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });
            }
            // Branch was created but we couldn't persist — surface as success with a note.
            console.error("[academies] persist failed after branch create", dbErr);
            return NextResponse.json({ ok: true, slug: cleanSlug, branch, persisted: false }, { status: 201 });
        }
    } catch (err) {
        console.error("[academies] unexpected error", err);
        return NextResponse.json({ error: "حصل خطأ غير متوقع، حاول تاني." }, { status: 500 });
    }
}
