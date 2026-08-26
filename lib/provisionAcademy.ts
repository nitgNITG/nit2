// Shared academy provisioning: create the client's GitHub branch, kick off the
// live-site build on server B, and record the academy in the control plane.
// Used by BOTH the free-tier path (POST /api/academies) and the paid path
// (the verified Kashier webhook, once payment is confirmed).

import prisma from "@/lib/prismaMysql";
import { toLicenseDefinition } from "@/lib/licenseDefinition";
import type { Brand } from "@/lib/brand";

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
    platformLang: string,
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
            }),
        });
    } catch (e) {
        console.error("[provision] trigger failed", e);
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

    // 3) Kick off the live build.
    const settings = await loadPlatformSettings();
    await triggerProvision(input.slug, input.name, brand, input.tier, settings, input.definition, {
        email: input.owner.email, name: input.owner.name, locale: input.owner.locale,
    }, input.platformLang);

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
