import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { toLicenseDefinition } from "@/lib/licenseDefinition";
import { type Brand, sanitizeBrand } from "@/lib/brand";
import { generateAdminPassword, encryptSecret } from "@/lib/secretBox";
import { buildIntegrationEnv } from "@/lib/integrations";

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
// Global platform settings (google_client_id, store URLs …) that must be identical
// for every academy. Read from the control plane and pushed into the new academy's
// Moodle at provision time so getsettings.php serves them. Only non-empty values.
async function loadPlatformSettings(): Promise<Record<string, string>> {
    try {
        const rows = await prisma.platformSetting.findMany();
        return Object.fromEntries(
            rows.filter((r) => (r.value ?? "").trim() !== "").map((r) => [r.key, r.value]),
        );
    } catch (e) {
        console.error("[academies] could not load platform settings", e);
        return {};
    }
}

async function triggerProvision(
    slug: string, name: string, brand: Brand, tier: string, settings: Record<string, string>, definition: string,
    owner: { email: string; name: string; locale: string },
    platformLang: string, ownerPass: string,
    integrations: Record<string, string> = {},
    adminPass: string = "",
): Promise<void> {
    const url = process.env.PROVISION_URL;       // e.g. https://saas-provision.academy2026.nitg-eg.com/provision
    const secret = process.env.PROVISION_SECRET;
    if (!url || !secret) return;
    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({
                slug, name, brand, tier, settings, definition,
                owner_email: owner.email, owner_name: owner.name, locale: owner.locale,
                platform_lang: platformLang,
                owner_pass: ownerPass, // nit2-generated so we can store it (encrypted) for recovery
                admin_pass: adminPass, // NIT super-admin `admin` pw (support), stored encrypted
                integrations,          // shared Kashier/VDOCipher/Vimeo creds for this package
            }),
        });
    } catch (e) {
        console.error("[academies] provision trigger failed", e);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, slug, _hp } = body ?? {};
        const brand = sanitizeBrand(body?.brand);

        // Honeypot — bots fill the hidden field, humans don't. Fake success.
        if (_hp) return NextResponse.json({ ok: true, branch: "" }, { status: 201 });

        // Must be a signed-in client — every academy is tied to its owner.
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "لازم تسجّل الدخول الأول." }, { status: 401 });
        }

        // Rate limit by IP
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (RATE_LIMIT > 0 && !checkRateLimit(ip)) {
            return NextResponse.json({ error: "محاولات كتير في وقت قصير، حاول بعد شوية." }, { status: 429 });
        }

        const cleanName = (name ?? "").toString().trim();
        const cleanSlug = (slug ?? "").toString().trim().toLowerCase();

        // Resolve the licence the client picked from the (dynamic) License table.
        const requestedKey = (body?.tier ?? "").toString().trim().toLowerCase();
        let lic = requestedKey
            ? await prisma.license.findFirst({ where: { key: requestedKey, active: true } })
            : null;
        if (!lic) {
            lic = await prisma.license.findFirst({ where: { active: true }, orderBy: [{ price: "asc" }, { order: "asc" }] });
        }
        const tier = lic?.key ?? "demo";
        const definition = lic ? toLicenseDefinition(lic) : "";

        // Free-academy quota — a global limit per user account (free_academy_limit).
        // Applies only to FREE licences (price 0), counting the client's academies
        // across ALL free licences. Paid licences are gated by payment, not counted.
        if (lic && lic.price === 0) {
            const row = await prisma.platformSetting.findUnique({ where: { key: "free_academy_limit" } });
            const limit = row ? parseInt(row.value, 10) : 1;
            if (Number.isFinite(limit) && limit >= 0) {
                const freeKeys = (await prisma.license.findMany({ where: { price: 0 }, select: { key: true } })).map((l) => l.key);
                const owned = await prisma.academy.count({ where: { ownerId: user.id, tier: { in: freeKeys } } });
                if (owned >= limit) {
                    return NextResponse.json(
                        { error: `وصلت للحد الأقصى من الأكاديميات المجانية (${limit}) لحسابك. اختر باقة مدفوعة لإضافة المزيد.` },
                        { status: 403 },
                    );
                }
            }
        }

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

        // The primary name field is the Arabic full name — use it as the AR site
        // name if the form didn't send one explicitly.
        if (!brand.fullname_ar) brand.fullname_ar = cleanName;

        // Branch created → kick off the live-site build on server B (fire-and-forget).
        const settings = await loadPlatformSettings();
        const locale = (body?.locale === "en" ? "en" : "ar");
        const platformLang = ["ar", "en", "both"].includes(body?.platform_lang) ? body.platform_lang : "both";
        const adminPassword = generateAdminPassword(); // owner account pw; stored encrypted below; create.sh sets it on `owner`
        const nitAdminPassword = generateAdminPassword(); // NIT super-admin `admin` pw (support), stored encrypted below
        const integrations = await buildIntegrationEnv({
            videoSource: lic?.videoSource ?? "all",
            kashierEnabled: !!lic?.kashierEnabled,
        });
        await triggerProvision(cleanSlug, cleanName, brand, tier, settings, definition, {
            email: user.email,
            name: user.name ?? "",
            locale,
        }, platformLang, adminPassword, integrations, nitAdminPassword);

        // 3) Record it (control plane). Guard the rare race on the unique slug.
        try {
            // Subscription term from the licence duration (0 days = never expires).
            const now = new Date();
            const days = lic?.durationDays ?? 0;
            const validUntil = days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
            const academy = await prisma.academy.create({
                data: {
                    name: cleanName, slug: cleanSlug, branch, status: "branch_created",
                    tier, ownerId: user.id, subscribedAt: now, validUntil,
                    adminPasswordEnc: encryptSecret(adminPassword), // owner account pw; null if CREDENTIAL_SECRET unset
                    nitAdminPasswordEnc: encryptSecret(nitAdminPassword), // NIT super-admin pw (support)
                },
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

// GET /api/academies[?status=branch_created]  — list control-plane records.
// Used by the fleet dashboard and by the server polling worker (pending deploys).
export async function GET(req: NextRequest) {
    try {
        const status = new URL(req.url).searchParams.get("status") || undefined;
        const academies = await prisma.academy.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ academies });
    } catch (err) {
        console.error("[academies] list failed", err);
        return NextResponse.json({ academies: [], error: "list failed" }, { status: 200 });
    }
}
