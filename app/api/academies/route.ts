import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { toLicenseDefinition, computeUpgradable } from "@/lib/licenseDefinition";
import { type Brand, sanitizeBrand } from "@/lib/brand";
import { generateAdminPassword, encryptSecret } from "@/lib/secretBox";
import { buildIntegrationEnv } from "@/lib/integrations";
import { notifyTelegram } from "@/lib/telegram";
import { evaluateServerHealth, formatHealth, creationBlockedMessage, healthBlockAlertBody } from "@/lib/serverHealth";
import { alertAdmins, supportWhatsapp } from "@/lib/adminAlert";
import { mailerConfigured } from "@/lib/mailer";
import { createAndSendOtp } from "@/lib/emailOtp";
import { settingOn, settingInt } from "@/lib/platformSettings";
import bcrypt from "bcrypt";
import crypto from "crypto";

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

// ── Daily per-IP creation cap (anti-abuse) ────────────────────────────────────
// Separate from the hourly burst limit above: this counts ACTUAL provision
// attempts (one machine can only spin up N academies per 24h), so someone can't
// register many throwaway accounts from the same IP and demo-farm from each.
// Controlled by env ACADEMIES_DAILY_IP_LIMIT: a number sets the cap; 0 disables.
// Counted only once we're about to provision (after validation + health gate), so
// typos and duplicate-slug retries don't burn the quota. In-memory per instance —
// same caveat as the hourly limiter; resets on restart and isn't shared across
// replicas, which is fine for a soft abuse brake.
// The cap itself is a control-plane setting (academies_daily_ip_limit, admin
// panel; ACADEMIES_DAILY_IP_LIMIT env as legacy fallback), read per request and
// passed in — so it can be changed without a rebuild. In-memory per instance:
// resets on restart and isn't shared across replicas (fine for a soft brake; see
// the MySQL-counter note if durability is ever needed).
const dailyIpCache = new Map<string, { count: number; resetAt: number }>();
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
function checkDailyIpLimit(ip: string, limit: number): boolean {
    const now = Date.now();
    const entry = dailyIpCache.get(ip);
    if (!entry || now > entry.resetAt) {
        dailyIpCache.set(ip, { count: 1, resetAt: now + DAILY_WINDOW_MS });
        return true;
    }
    if (entry.count >= limit) return false;
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
    homepageTemplate: string = "t1",
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
                homepageTemplate,      // homepage look (t1..t10); create.sh runs apply_homepage_template.php
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

        // Admin comp: an admin may create an academy FOR another user, on ANY tier
        // (including contact-sales like Professional), with no payment. The owner is
        // resolved by id (from the picker) or email; a new user can be created inline.
        // adminComp bypasses the verified-email gate, quota, rate/daily caps and the
        // contact-sales refusal below — and the academy is recorded under that owner.
        const isAdmin = user.role === "admin";
        let owner: { id: string; email: string; name: string } = { id: user.id, email: user.email, name: user.name ?? "" };
        let adminComp = false;
        let createdOwnerPassword: string | null = null;
        if (isAdmin && (body?.ownerId || body?.ownerEmail)) {
            adminComp = true;
            let o: { id: string; email: string; name: string | null } | null = null;
            if (body?.ownerId) o = await prisma.user.findUnique({ where: { id: String(body.ownerId) }, select: { id: true, email: true, name: true } });
            if (!o && body?.ownerEmail) o = await prisma.user.findFirst({ where: { email: String(body.ownerEmail).toLowerCase() }, select: { id: true, email: true, name: true } });
            if (!o) {
                // New-user option: create the owner inline when enough info is given.
                const email = String(body?.ownerEmail ?? "").trim().toLowerCase();
                const oname = String(body?.ownerName ?? "").trim();
                if (!email || oname.length < 2) {
                    return NextResponse.json({ error: "اختر مالكاً موجوداً أو اكتب بريد واسم مالك جديد." }, { status: 400 });
                }
                const provided = String(body?.ownerPassword ?? "");
                const pwd = provided.length >= 8 ? provided : crypto.randomBytes(9).toString("base64url");
                if (provided.length < 8) createdOwnerPassword = pwd;
                try {
                    const created = await prisma.user.create({ data: { name: oname, email, password: await bcrypt.hash(pwd, 10), role: "client", emailVerified: true } });
                    o = { id: created.id, email: created.email, name: created.name };
                } catch (e: any) {
                    if (e?.code === "P2002") return NextResponse.json({ error: "البريد ده مسجّل بالفعل." }, { status: 409 });
                    console.error("[academies] admin owner create failed", e);
                    return NextResponse.json({ error: "تعذّر إنشاء المستخدم." }, { status: 500 });
                }
            }
            owner = { id: o.id, email: o.email, name: o.name ?? "" };
        }

        // Verified-email gate — a confirmed inbox is required before provisioning a
        // real container, so a throwaway account can't demo-farm. Toggled from the
        // admin panel (require_email_verification; REQUIRE_EMAIL_VERIFICATION env as
        // legacy fallback) — the same switch that gates sign-in. Existing accounts
        // were grandfathered (emailVerified=true) by the verification migration. We
        // resend a code so the client can verify right away.
        if (!adminComp && (await settingOn("require_email_verification", "REQUIRE_EMAIL_VERIFICATION")) && mailerConfigured()) {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { emailVerified: true, name: true },
            });
            if (dbUser && !dbUser.emailVerified) {
                await createAndSendOtp(user.email.toLowerCase(), "verify", {
                    name: dbUser.name ?? user.name ?? "",
                    locale: body?.locale === "en" ? "en" : "ar",
                }).catch(() => {});
                return NextResponse.json(
                    {
                        error: "لازم تأكيد بريدك الإلكتروني الأول قبل إنشاء أكاديمية. / Please verify your email before creating an academy.",
                        errorcode: "email_unverified",
                        needsVerify: true,
                        email: user.email.toLowerCase(),
                    },
                    { status: 403 },
                );
            }
        }

        // Rate limit by IP
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (!adminComp && RATE_LIMIT > 0 && !checkRateLimit(ip)) {
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
            lic = await prisma.license.findFirst({ where: { active: true, contactSales: false }, orderBy: [{ price: "asc" }, { order: "asc" }] });
        }
        // "Contact sales" plans are provisioned only after a sales conversation —
        // never through the self-serve create flow.
        if (lic?.contactSales && !adminComp) {
            return NextResponse.json(
                { error: "هذه الباقة بالطلب — تواصل مع المبيعات. / This plan is available by request — please contact sales." },
                { status: 400 },
            );
        }
        const tier = lic?.key ?? "demo";
        const rankLics = await prisma.license.findMany({ where: { active: true }, select: { key: true, active: true, order: true, priceEgp: true } });
        const definition = lic
            ? toLicenseDefinition(lic, {
                  validUntil: (lic.durationDays ?? 0) > 0
                      ? new Date(Date.now() + (lic.durationDays ?? 0) * 86_400_000)
                      : null,
                  // Subscription start = creation time (mirrors Academy.subscribedAt,
                  // set unconditionally below). Always known — even a free/never-expiring
                  // tier has a start date — so it is NOT gated on durationDays.
                  subscribedAt: new Date(),
                  upgradable: computeUpgradable(tier, rankLics),
              })
            : "";

        // Free-academy quota — a global limit per user account (free_academy_limit).
        // Applies only to FREE licences (price 0), counting the client's academies
        // across ALL free licences. Paid licences are gated by payment, not counted.
        if (!adminComp && lic && lic.price === 0) {
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

        // Server-B health gate: never provision onto a host that's out of disk or
        // unreachable. Alert the admins (Telegram + email) and refuse with a
        // support message. The health snapshot is reused in the success alert below.
        const verdict = await evaluateServerHealth();
        if (!verdict.ok) {
            await alertAdmins(
                `🚫 Academy creation blocked — ${cleanSlug}`,
                `${healthBlockAlertBody(verdict)}\n\nRequested by: ${user.email ?? user.id} · tier ${tier}`,
            );
            return NextResponse.json(
                {
                    error: creationBlockedMessage(),
                    errorcode: "server_unhealthy",
                    reason: verdict.reason,
                    support_whatsapp: await supportWhatsapp(),
                },
                { status: 503 },
            );
        }

        // Daily per-IP creation cap — counted here (after validation + health gate,
        // before we actually provision) so failed/duplicate attempts don't burn it.
        const dailyLimit = await settingInt("academies_daily_ip_limit", 5, "ACADEMIES_DAILY_IP_LIMIT");
        if (!adminComp && dailyLimit > 0 && !checkDailyIpLimit(ip, dailyLimit)) {
            return NextResponse.json(
                {
                    error: `وصلت للحد الأقصى لإنشاء الأكاديميات اليوم (${dailyLimit}). حاول بكرة أو تواصل مع الدعم. / Daily academy-creation limit reached (${dailyLimit}). Try again tomorrow or contact support.`,
                    errorcode: "daily_ip_limit",
                },
                { status: 429 },
            );
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
        // Account/dashboard base URL for the in-academy "Upgrade" deep link.
        {
            const proto = req.headers.get("x-forwarded-proto") || "https";
            const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
            const accountUrl = (host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "")).replace(/\/$/, "");
            if (accountUrl) settings.account_url = accountUrl;
        }
        const locale = (body?.locale === "en" ? "en" : "ar");
        const platformLang = ["ar", "en", "both"].includes(body?.platform_lang) ? body.platform_lang : "both";
        const homepageTemplate = /^t([1-9]|10)$/.test(body?.homepageTemplate) ? body.homepageTemplate : "t1";
        const adminPassword = generateAdminPassword(); // owner account pw; stored encrypted below; create.sh sets it on `owner`
        const nitAdminPassword = generateAdminPassword(); // NIT super-admin `admin` pw (support), stored encrypted below
        const integrations = await buildIntegrationEnv({
            videoSource: lic?.videoSource ?? "all",
            kashierEnabled: !!lic?.kashierEnabled,
        });
        await triggerProvision(cleanSlug, cleanName, brand, tier, settings, definition, {
            email: owner.email,
            name: owner.name,
            locale,
        }, platformLang, adminPassword, integrations, nitAdminPassword, homepageTemplate);

        // 3) Record it (control plane). Guard the rare race on the unique slug.
        try {
            // Subscription term from the licence duration (0 days = never expires).
            const now = new Date();
            const days = lic?.durationDays ?? 0;
            const validUntil = days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
            const academy = await prisma.academy.create({
                data: {
                    name: cleanName, slug: cleanSlug, branch, status: "branch_created",
                    tier, ownerId: owner.id, subscribedAt: now, validUntil,
                    adminPasswordEnc: encryptSecret(adminPassword), // owner account pw; null if CREDENTIAL_SECRET unset
                    nitAdminPasswordEnc: encryptSecret(nitAdminPassword), // NIT super-admin pw (support)
                },
            });
            // Announce the new academy to admins WITH the server-B health snapshot
            // (Telegram + email), per the manager's request.
            await alertAdmins(
                `🆕 New academy: ${academy.slug} ("${cleanName}") — tier ${tier}` +
                (owner.email ? ` · ${owner.email}` : "") + (adminComp ? " · by admin" : ""),
                formatHealth(verdict.health),
            );
            return NextResponse.json(
                {
                    ok: true, slug: academy.slug, branch: academy.branch,
                    // When the admin created a NEW owner inline, return the generated password once.
                    ...(createdOwnerPassword ? { ownerPassword: createdOwnerPassword, ownerEmail: owner.email } : {}),
                },
                { status: 201 }
            );
        } catch (dbErr: any) {
            // P2002 = unique constraint (two requests raced on the same slug).
            if (dbErr?.code === "P2002") {
                return NextResponse.json({ error: "المعرّف ده مستخدم بالفعل، اختار غيره." }, { status: 409 });
            }
            // Branch was created but we couldn't persist — surface as success with a note.
            console.error("[academies] persist failed after branch create", dbErr);
            await notifyTelegram(
                `⚠️ Provision issue: ${cleanSlug} — branch built but NOT recorded in the control plane ` +
                `(orphaned academy, needs manual fix).`,
            );
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
        // Attach owner name/email — ownerId is a plain-string join, not a relation.
        const ownerIds = Array.from(
            new Set(academies.map((a) => a.ownerId).filter(Boolean) as string[]),
        );
        const owners = ownerIds.length
            ? await prisma.user.findMany({
                  where: { id: { in: ownerIds } },
                  select: { id: true, name: true, email: true },
              })
            : [];
        const ownerById = new Map(owners.map((u) => [u.id, u]));
        const withOwners = academies.map((a) => ({
            ...a,
            owner: a.ownerId ? ownerById.get(a.ownerId) ?? null : null,
        }));
        // Is the shared Google OAuth client configured? True only when BOTH the
        // client id and secret are set in platform settings. The secret value is
        // never sent to the client — only this boolean — so the dashboard can tell
        // the admin whether Google login is set up (and to add redirect URIs in the
        // Google console) without leaking the credential.
        let googleConfigured = false;
        try {
            const rows = await prisma.platformSetting.findMany({
                where: { key: { in: ["google_client_id", "google_client_secret"] } },
            });
            const map = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));
            googleConfigured = !!map.get("google_client_id") && !!map.get("google_client_secret");
        } catch (e) {
            console.error("[academies] google-config check failed", e);
        }
        return NextResponse.json({ academies: withOwners, googleConfigured });
    } catch (err) {
        console.error("[academies] list failed", err);
        return NextResponse.json({ academies: [], error: "list failed" }, { status: 200 });
    }
}
