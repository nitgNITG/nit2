// Shared academy provisioning: create the client's GitHub branch, kick off the
// live-site build on server B, and record the academy in the control plane.
// Used by BOTH the free-tier path (POST /api/academies) and the paid path
// (the verified Kashier webhook, once payment is confirmed).

import prisma from "@/lib/prismaMysql";
import { toLicenseDefinition } from "@/lib/licenseDefinition";
import type { Brand } from "@/lib/brand";
import { generateAdminPassword, encryptSecret } from "@/lib/secretBox";
import { buildIntegrationEnv, hasIntegrationPayload } from "@/lib/integrations";

const OWNER = process.env.SAAS_REPO_OWNER ?? "NITGg";
const REPO = process.env.SAAS_REPO_NAME ?? "saas-demo";
const BASE_BRANCH = process.env.SAAS_BASE_BRANCH ?? "main";
const GH_API = "https://api.github.com";

const ghHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
});

/** Global platform settings pushed into every academy's Moodle at provision time. */
export async function loadPlatformSettings(): Promise<Record<string, string>> {
    try {
        const rows = await prisma.platformSetting.findMany();
        return Object.fromEntries(
            rows.filter((r) => (r.value ?? "").trim() !== "").map((r) => [r.key, r.value]),
        );
    } catch (e) {
        console.error("[provision] could not load platform settings", e);
        return {};
    }
}

/** Ask server B to turn the branch into a live site (best-effort, fire-and-forget). */
export async function triggerProvision(
    slug: string, name: string, brand: Brand, tier: string,
    settings: Record<string, string>, definition: string,
    owner: { email: string; name: string; locale: string },
    platformLang: string, ownerPass: string,
    integrations: Record<string, string> = {},
    adminPass: string = "",
): Promise<void> {
    const url = process.env.PROVISION_URL;
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
                // nit2 generates the admin password so it can store it (encrypted)
                // for recovery; create.sh uses it verbatim instead of generating.
                owner_pass: ownerPass,
                // NIT super-admin `admin` password — nit2 generates + stores it
                // (encrypted) so support can view it in the dashboard to debug a
                // broken academy. create.sh sets it on the `admin` account.
                admin_pass: adminPass,
                // Shared platform integration creds pushed to this academy's Moodle
                // plugins by create.sh (based on the licence). create.sh runs the
                // push after the container is up.
                integrations,
            }),
        });
    } catch (e) {
        console.error("[provision] trigger failed", e);
    }
}

/** Push the shared integration creds (Kashier/VDOCipher/Vimeo) to a LIVE academy
 *  for its licence — used on tier change (the container already exists, so this is
 *  a separate call rather than riding the create payload). Best-effort. */
export async function triggerApplyIntegrations(
    slug: string, license: { videoSource: string; kashierEnabled: boolean },
): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const integrations = await buildIntegrationEnv(license);
        if (!hasIntegrationPayload(integrations)) return;
        const url = new URL(base);
        url.pathname = `/apply-integrations/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ integrations }),
        });
    } catch (e) {
        console.error("[provision] apply-integrations failed", slug, e);
    }
}

/**
 * Reset a live academy's admin password to a NEW generated value and re-send the
 * welcome email. Used to recover access when the original welcome email is lost,
 * or after the owner changed (and forgot) their password. Server B re-mints the
 * app token afterwards (a password change wipes web-service tokens). Returns the
 * new plaintext password on success (caller stores it encrypted), or null.
 */
export async function triggerResetWelcome(
    slug: string, owner?: { email?: string; name?: string; locale?: string },
): Promise<string | null> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return null;
    const newPass = generateAdminPassword();
    try {
        const url = new URL(base);
        url.pathname = `/reset-welcome/${slug}`;
        const res = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({
                owner_pass: newPass,
                owner_email: owner?.email ?? "", owner_name: owner?.name ?? "",
                locale: owner?.locale ?? "ar",
            }),
        });
        if (!res.ok) return null;
        return newPass;
    } catch (e) {
        console.error("[provision] reset-welcome failed", slug, e);
        return null;
    }
}

/**
 * Ask server B to soft-lock (suspend) or unlock (resume) a live academy. Data is
 * preserved either way — reversible. Best-effort/fire-and-forget. Used by the
 * expiry cron (suspend) and the renew webhook (resume).
 */
export async function triggerSuspend(slug: string, suspended: boolean): Promise<void> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return;
    try {
        const url = new URL(base);
        url.pathname = `/suspend/${slug}`;
        await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: JSON.stringify({ suspended }),
        });
    } catch (e) {
        console.error("[provision] suspend trigger failed", slug, e);
    }
}

/** Per-academy moodledata usage from server B (bytes) + host disk headroom.
 * Best-effort: returns null if the provisioning service is unreachable. */
export async function fetchAcademyUsage(): Promise<
    { academies: Record<string, number>; host_disk_pct: number; host_free_bytes: number } | null
> {
    const base = process.env.PROVISION_URL;
    const secret = process.env.PROVISION_SECRET;
    if (!base || !secret) return null;
    try {
        const url = new URL(base);
        url.pathname = "/usage";
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url.toString(), {
            headers: { "X-Provision-Secret": secret },
            cache: "no-store",
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("[provision] usage fetch failed", e);
        return null;
    }
}

export type ProvisionInput = {
    slug: string;
    name: string;
    brand: Brand;
    tier: string;
    /** License row for the tier (durationDays drives the subscription term). */
    durationDays: number;
    definition: string;
    owner: { id: string; email: string; name: string; locale: "ar" | "en" };
    platformLang: "ar" | "en" | "both";
};

export type ProvisionResult =
    | { ok: true; slug: string; branch: string; persisted: boolean }
    | { ok: false; error: string; status: number };

/**
 * Create the branch, trigger the live build, and record the academy. Assumes the
 * caller has already validated the user, slug format, name, and licence/quota.
 */
export async function provisionAcademy(input: ProvisionInput): Promise<ProvisionResult> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.error("[provision] GITHUB_TOKEN is not set");
        return { ok: false, error: "الخدمة غير مهيأة حالياً، جرّب لاحقاً.", status: 500 };
    }
    const branch = `client/${input.slug}`;
    const headers = ghHeaders(token);

    // Already taken?
    try {
        const existing = await prisma.academy.findUnique({ where: { slug: input.slug } });
        if (existing) return { ok: false, error: "المعرّف ده مستخدم بالفعل، اختار غيره.", status: 409 };
    } catch (e) {
        console.warn("[provision] duplicate pre-check skipped (DB unavailable)", e);
    }

    // 1) SHA of the base branch.
    const refRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BASE_BRANCH}`, {
        headers, cache: "no-store",
    });
    if (!refRes.ok) {
        console.error("[provision] read base failed", refRes.status);
        return { ok: false, error: "تعذّر الوصول للفرع الأساسي، حاول تاني.", status: 502 };
    }
    const baseSha: string = (await refRes.json()).object.sha;

    // 2) Create the client branch.
    const createRes = await fetch(`${GH_API}/repos/${OWNER}/${REPO}/git/refs`, {
        method: "POST", headers,
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
    if (createRes.status === 422) return { ok: false, error: "المعرّف ده مستخدم بالفعل، اختار غيره.", status: 409 };
    if (!createRes.ok) {
        console.error("[provision] create branch failed", createRes.status);
        return { ok: false, error: "فشل إنشاء المنصة، حاول تاني.", status: 502 };
    }

    const brand = { ...input.brand };
    if (!brand.fullname_ar) brand.fullname_ar = input.name;

    // 3) Kick off the live build. nit2 generates the OWNER account password here
    //    so it can be stored (encrypted) for recovery; create.sh sets it on the
    //    restricted `owner` account (the NIT super-admin `admin` account gets a
    //    separate random password inside create.sh, never stored/emailed).
    const adminPassword = generateAdminPassword();          // customer's OWNER login
    const nitAdminPassword = generateAdminPassword();        // NIT super-admin `admin` login (support)
    const settings = await loadPlatformSettings();
    // Shared integration creds for this package (create.sh applies them after the
    // container is up). Best-effort: fetch the licence's video/kashier selection.
    let integrations: Record<string, string> = {};
    try {
        const lic = await prisma.license.findUnique({ where: { key: input.tier } });
        integrations = await buildIntegrationEnv({
            videoSource: lic?.videoSource ?? "all",
            kashierEnabled: !!lic?.kashierEnabled,
        });
    } catch (e) {
        console.error("[provision] build integrations failed", e);
    }
    await triggerProvision(input.slug, input.name, brand, input.tier, settings, input.definition, {
        email: input.owner.email, name: input.owner.name, locale: input.owner.locale,
    }, input.platformLang, adminPassword, integrations, nitAdminPassword);

    // 4) Record the academy with its subscription term.
    try {
        const now = new Date();
        const validUntil = input.durationDays > 0
            ? new Date(now.getTime() + input.durationDays * 86_400_000)
            : null;
        const academy = await prisma.academy.create({
            data: {
                name: input.name, slug: input.slug, branch, status: "branch_created",
                tier: input.tier, ownerId: input.owner.id, subscribedAt: now, validUntil,
                adminPasswordEnc: encryptSecret(adminPassword), // owner account pw; null if CREDENTIAL_SECRET unset
                nitAdminPasswordEnc: encryptSecret(nitAdminPassword), // NIT super-admin pw (support)
            },
        });
        return { ok: true, slug: academy.slug, branch: academy.branch, persisted: true };
    } catch (e: any) {
        if (e?.code === "P2002") return { ok: false, error: "المعرّف ده مستخدم بالفعل، اختار غيره.", status: 409 };
        console.error("[provision] persist failed after branch create", e);
        return { ok: true, slug: input.slug, branch, persisted: false };
    }
}

/** Build a definition string from a License row (re-export for callers). */
export function licenseToDefinition(lic: Parameters<typeof toLicenseDefinition>[0]): string {
    return toLicenseDefinition(lic);
}
